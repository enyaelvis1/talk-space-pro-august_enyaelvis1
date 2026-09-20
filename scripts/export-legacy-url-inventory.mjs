import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE_ROOT = process.env.WORDPRESS_SITE_ROOT || "https://www.talkspace.ng";
const exportDate = process.argv[2] || new Date().toISOString().slice(0, 10);
const sourceInventoryPath = resolve(
  process.cwd(),
  process.argv[3] || "docs/migration/wordpress-inventory-2026-08-02.json",
);
const outputDirectory = resolve(process.cwd(), process.argv[4] || "docs/migration");
const sitemapIndexUrl = new URL("/sitemap_index.xml", SITE_ROOT).href;

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function tag(block, name) {
  const match = block.match(
    new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "is"),
  );
  return match ? decodeXml(match[1].trim()) : null;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`);
  return response.text();
}

function sitemapType(url) {
  const filename = new URL(url).pathname.split("/").at(-1) || "sitemap";
  return filename.replace(/-sitemap\.xml$/i, "") || "sitemap";
}

async function fetchSitemapRecords() {
  const indexXml = await fetchText(sitemapIndexUrl);
  const sitemapUrls = [...indexXml.matchAll(/<sitemap>(.*?)<\/sitemap>/gis)]
    .map((match) => tag(match[1], "loc"))
    .filter(Boolean);
  const childDocuments = await Promise.all(
    sitemapUrls.map(async (url) => ({ url, xml: await fetchText(url) })),
  );
  return childDocuments.flatMap(({ url, xml }) =>
    [...xml.matchAll(/<url>(.*?)<\/url>/gis)].flatMap((match) => {
      const location = tag(match[1], "loc");
      return location
        ? [{ url: location, type: sitemapType(url), lastModified: tag(match[1], "lastmod") }]
        : [];
    }),
  );
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

function addRecord(map, value, source, kind, lastModified = null) {
  if (!value) return;
  const url = normalizeUrl(value);
  const existing = map.get(url);
  if (existing) {
    existing.sources = [...new Set([...existing.sources, source])];
    existing.kinds = [...new Set([...existing.kinds, kind])];
    existing.lastModified ||= lastModified;
    return;
  }
  map.set(url, { url, sources: [source], kinds: [kind], lastModified });
}

async function inspectUrl(record) {
  try {
    let response = await fetch(record.url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(record.url, {
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
    }
    return {
      ...record,
      status: response.status,
      finalUrl: normalizeUrl(response.url || record.url),
      contentType: response.headers.get("content-type"),
      reachable: response.ok,
      error: null,
    };
  } catch (error) {
    return {
      ...record,
      status: null,
      finalUrl: null,
      contentType: null,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapConcurrent(values, concurrency, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await mapper(values[index]);
      }
    }),
  );
  return output;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function markdown(summary, jsonFilename, csvFilename) {
  return `# Legacy URL inventory

Generated on **${summary.exportDate}** from the live WordPress sitemap and the dated REST inventory.

| URL class | Count |
| --- | ---: |
| Unique URLs | ${summary.total} |
| Sitemap URLs | ${summary.sitemapUrls} |
| Content URLs | ${summary.contentUrls} |
| Media attachment pages | ${summary.mediaAttachmentUrls} |
| Direct media assets | ${summary.mediaAssetUrls} |
| Reachable now | ${summary.reachable} |
| Redirected to a different URL | ${summary.redirected} |
| Verification rate-limited by WordPress | ${summary.rateLimited} |
| Confirmed unreachable or errored | ${summary.unreachable} |

- Sitemap index: ${summary.sitemapIndexUrl}
- WordPress inventory: \`${summary.sourceInventoryPath}\`
- Machine-readable inventory: [${jsonFilename}](${jsonFilename})
- Review spreadsheet: [${csvFilename}](${csvFilename})

## Scope

The inventory merges every URL published in the WordPress page, post, and category sitemaps with content, media attachment, and direct media asset URLs returned by the REST inventory. Duplicate and trailing-slash variants are normalized. HTTP status and final destination were checked without modifying the source site.

Use the admin **Content migration** screen for approval decisions. A URL being reachable or currently published does not make it approved for migration or deletion.
`;
}

const sourceInventory = JSON.parse(await readFile(sourceInventoryPath, "utf8"));
const sitemapRecords = await fetchSitemapRecords();
const records = new Map();

for (const record of sitemapRecords) {
  addRecord(records, record.url, "sitemap", `sitemap_${record.type}`, record.lastModified);
}
for (const record of sourceInventory.content ?? []) {
  addRecord(records, record.url, "wordpress_rest", `content_${record.type}`, record.modifiedAt);
}
for (const record of sourceInventory.media ?? []) {
  addRecord(records, record.url, "wordpress_rest", "media_attachment", record.modifiedAt);
  addRecord(records, record.sourceUrl, "wordpress_rest", "media_asset", record.modifiedAt);
}

const verificationConcurrency = Math.max(
  1,
  Math.min(6, Number(process.env.URL_CHECK_CONCURRENCY || 3)),
);
const inspected = await mapConcurrent([...records.values()], verificationConcurrency, inspectUrl);
inspected.sort((left, right) => left.url.localeCompare(right.url));
const summary = {
  exportDate,
  generatedAt: new Date().toISOString(),
  sitemapIndexUrl,
  sourceInventoryPath: sourceInventoryPath.replace(`${process.cwd()}/`, ""),
  total: inspected.length,
  sitemapUrls: inspected.filter((record) => record.sources.includes("sitemap")).length,
  contentUrls: inspected.filter((record) =>
    record.kinds.some((kind) => kind.startsWith("content_")),
  ).length,
  mediaAttachmentUrls: inspected.filter((record) => record.kinds.includes("media_attachment"))
    .length,
  mediaAssetUrls: inspected.filter((record) => record.kinds.includes("media_asset")).length,
  reachable: inspected.filter((record) => record.reachable).length,
  redirected: inspected.filter((record) => record.finalUrl && record.finalUrl !== record.url)
    .length,
  rateLimited: inspected.filter((record) => record.status === 429).length,
  unreachable: inspected.filter((record) => !record.reachable && record.status !== 429).length,
};

const basename = `legacy-url-inventory-${exportDate}`;
const jsonFilename = `${basename}.json`;
const csvFilename = `${basename}.csv`;
const markdownFilename = `LEGACY_URL_INVENTORY_${exportDate}.md`;
const csvHeader = [
  "url",
  "kinds",
  "sources",
  "last_modified",
  "http_status",
  "final_url",
  "reachable",
  "content_type",
  "error",
];
const csvRows = inspected.map((record) =>
  [
    record.url,
    record.kinds.join("|"),
    record.sources.join("|"),
    record.lastModified,
    record.status,
    record.finalUrl,
    record.reachable,
    record.contentType,
    record.error,
  ]
    .map(csvCell)
    .join(","),
);

await Promise.all([
  writeFile(
    resolve(outputDirectory, jsonFilename),
    `${JSON.stringify({ summary, urls: inspected }, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(outputDirectory, csvFilename),
    `${csvHeader.map(csvCell).join(",")}\n${csvRows.join("\n")}\n`,
    "utf8",
  ),
  writeFile(
    resolve(outputDirectory, markdownFilename),
    markdown(summary, jsonFilename, csvFilename),
    "utf8",
  ),
]);

console.log(
  `Inventoried ${summary.total} unique legacy URLs (${summary.rateLimited} rate-limited, ${summary.unreachable} confirmed unreachable).`,
);
