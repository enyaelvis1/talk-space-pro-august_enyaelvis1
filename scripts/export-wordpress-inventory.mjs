import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_ROOT = process.env.WORDPRESS_API_ROOT || "https://www.talkspace.ng/wp-json/wp/v2";
const PAGE_SIZE = 100;
const exportDate = process.argv[2] || new Date().toISOString().slice(0, 10);
const outputDirectory = resolve(process.cwd(), process.argv[3] || "docs/migration");

function text(value) {
  return String(value?.rendered ?? value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

async function fetchCollection(type) {
  const records = [];
  let totalPages = 1;
  let reportedTotal = 0;

  for (let page = 1; page <= totalPages; page += 1) {
    const url = new URL(`${API_ROOT}/${type}`);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("orderby", "id");
    url.searchParams.set("order", "asc");
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${type} page ${page} failed with HTTP ${response.status}`);
    totalPages = Number(response.headers.get("x-wp-totalpages") || 1);
    reportedTotal = Number(response.headers.get("x-wp-total") || reportedTotal);
    records.push(...(await response.json()));
  }

  return { records, reportedTotal };
}

function contentRecord(type, record) {
  const body = String(record.content?.rendered ?? "");
  const excerpt = String(record.excerpt?.rendered ?? "");
  return {
    id: record.id,
    type,
    status: record.status ?? "publish",
    slug: record.slug,
    url: record.link,
    title: text(record.title),
    authorId: record.author ?? null,
    featuredMediaId: record.featured_media || null,
    categoryIds: record.categories ?? [],
    tagIds: record.tags ?? [],
    publishedAt: record.date_gmt || record.date || null,
    modifiedAt: record.modified_gmt || record.modified || null,
    excerptBytes: Buffer.byteLength(excerpt),
    bodyBytes: Buffer.byteLength(body),
    bodySha256: hash(body),
  };
}

function categoryRecord(record) {
  return {
    id: record.id,
    type: "category",
    status: "publish",
    slug: record.slug,
    url: record.link,
    title: record.name,
    descriptionBytes: Buffer.byteLength(String(record.description ?? "")),
    postCount: record.count ?? 0,
  };
}

function mediaRecord(record) {
  return {
    id: record.id,
    status: record.status ?? "inherit",
    slug: record.slug,
    url: record.link,
    sourceUrl: record.source_url,
    title: text(record.title),
    altText: record.alt_text || null,
    caption: text(record.caption) || null,
    mimeType: record.mime_type || null,
    mediaType: record.media_type || null,
    width: record.media_details?.width ?? null,
    height: record.media_details?.height ?? null,
    fileBytes: record.media_details?.filesize ?? null,
    publishedAt: record.date_gmt || record.date || null,
    modifiedAt: record.modified_gmt || record.modified || null,
  };
}

function latestTimestamp(records) {
  return (
    records
      .map((record) => record.modifiedAt || record.publishedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  );
}

function markdown(summary, jsonFilename) {
  return `# WordPress content and media inventory

Generated on **${summary.exportDate}** from \`${summary.apiRoot}\`.

This is a metadata inventory for migration decisions. It deliberately stores content hashes and byte counts instead of duplicating full article bodies; the full July source snapshot remains in \`supabase/migrations/20260715120000_talkspace_content_seed.sql\`.

| Record type | Count |
| --- | ---: |
| Pages | ${summary.pages} |
| Posts | ${summary.posts} |
| Categories | ${summary.categories} |
| Public media records returned | ${summary.media} |
| Media total reported by WordPress | ${summary.mediaReportedTotal} |
| Media records not returned by the public API | ${summary.mediaNotReturned} |
| Content records without featured media | ${summary.withoutFeaturedMedia} |
| Media records without alt text | ${summary.mediaWithoutAltText} |

- Latest content modification: ${summary.latestContentModification || "Not reported"}
- Latest media modification: ${summary.latestMediaModification || "Not reported"}
- Machine-readable inventory: [${jsonFilename}](${jsonFilename})

## Usage

Refresh the inventory without importing or deleting anything:

\`\`\`bash
node scripts/export-wordpress-inventory.mjs YYYY-MM-DD
\`\`\`

Review this inventory with the content owner before selecting records for migration or removal.
`;
}

const [pageResult, postResult, categoryResult, mediaResult] = await Promise.all([
  fetchCollection("pages"),
  fetchCollection("posts"),
  fetchCollection("categories"),
  fetchCollection("media"),
]);
const pages = pageResult.records;
const posts = postResult.records;
const categories = categoryResult.records;
const media = mediaResult.records;

const content = [
  ...pages.map((record) => contentRecord("page", record)),
  ...posts.map((record) => contentRecord("post", record)),
  ...categories.map(categoryRecord),
];
const mediaInventory = media.map(mediaRecord);
const summary = {
  exportDate,
  generatedAt: new Date().toISOString(),
  apiRoot: API_ROOT,
  pages: pages.length,
  posts: posts.length,
  categories: categories.length,
  media: media.length,
  mediaReportedTotal: mediaResult.reportedTotal,
  mediaNotReturned: Math.max(0, mediaResult.reportedTotal - media.length),
  withoutFeaturedMedia: [...pages, ...posts].filter((record) => !record.featured_media).length,
  mediaWithoutAltText: media.filter((record) => !String(record.alt_text || "").trim()).length,
  latestContentModification: latestTimestamp(content),
  latestMediaModification: latestTimestamp(mediaInventory),
};

const jsonFilename = `wordpress-inventory-${exportDate}.json`;
const markdownFilename = `WORDPRESS_INVENTORY_${exportDate}.md`;
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(outputDirectory, jsonFilename),
    `${JSON.stringify({ summary, content, media: mediaInventory }, null, 2)}\n`,
    "utf8",
  ),
  writeFile(resolve(outputDirectory, markdownFilename), markdown(summary, jsonFilename), "utf8"),
]);

console.log(
  `Exported ${content.length} content records and ${mediaInventory.length} media records to ${outputDirectory}`,
);
