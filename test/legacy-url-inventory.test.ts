import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = JSON.parse(
  await readFile(
    new URL("../docs/migration/legacy-url-inventory-2026-08-02.json", import.meta.url),
    "utf8",
  ),
) as {
  summary: Record<string, number | string>;
  urls: Array<{ url: string; kinds: string[]; sources: string[] }>;
};
const exporter = await readFile(
  new URL("../scripts/export-legacy-url-inventory.mjs", import.meta.url),
  "utf8",
);

test("legacy URL inventory merges sitemap, content, attachment, and asset URLs", () => {
  assert.equal(inventory.summary.total, 458);
  assert.equal(inventory.summary.sitemapUrls, 96);
  assert.equal(inventory.summary.contentUrls, 100);
  assert.equal(inventory.summary.mediaAttachmentUrls, 179);
  assert.equal(inventory.summary.mediaAssetUrls, 179);
  assert.equal(new Set(inventory.urls.map((record) => record.url)).size, inventory.urls.length);
  assert.ok(inventory.urls.every((record) => record.kinds.length && record.sources.length));
  assert.equal(
    Number(inventory.summary.reachable) +
      Number(inventory.summary.rateLimited) +
      Number(inventory.summary.unreachable),
    inventory.urls.length,
  );
});

test("legacy URL exporter is read-only and preserves rate-limited results", () => {
  assert.match(exporter, /sitemap_index\.xml/);
  assert.match(exporter, /media_attachment/);
  assert.match(exporter, /media_asset/);
  assert.match(exporter, /record\.status === 429/);
  assert.doesNotMatch(exporter, /@supabase|createClient|\.from\(["']\w/);
});
