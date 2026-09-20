import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = JSON.parse(
  await readFile(
    new URL("../docs/migration/wordpress-inventory-2026-08-02.json", import.meta.url),
    "utf8",
  ),
) as {
  summary: Record<string, number | string | null>;
  content: Array<{ id: number; type: string; bodySha256?: string }>;
  media: Array<{ id: number; sourceUrl: string }>;
};
const exporter = await readFile(
  new URL("../scripts/export-wordpress-inventory.mjs", import.meta.url),
  "utf8",
);
const mediaImporter = await readFile(
  new URL("../scripts/import-talkspace-media.mjs", import.meta.url),
  "utf8",
);

test("WordPress inventory contains the refreshed content and public media export", () => {
  assert.equal(inventory.summary.pages, 9);
  assert.equal(inventory.summary.posts, 84);
  assert.equal(inventory.summary.categories, 7);
  assert.equal(inventory.content.length, 100);
  assert.equal(inventory.media.length, inventory.summary.media);
  assert.equal(
    Number(inventory.summary.mediaReportedTotal) - inventory.media.length,
    inventory.summary.mediaNotReturned,
  );
  assert.ok(inventory.content.every((record) => record.id && record.type));
  assert.ok(inventory.media.every((record) => record.id && record.sourceUrl));
});

test("WordPress inventory exporter is read-only and reproducible", () => {
  assert.match(exporter, /Promise\.all/);
  assert.match(exporter, /wordpress-inventory-/);
  assert.match(exporter, /bodySha256/);
  assert.doesNotMatch(exporter, /@supabase|createClient|\.from\(/);
});

test("WordPress media importer tolerates slow legacy image bodies", () => {
  assert.match(mediaImporter, /process\.env\.MEDIA_TIMEOUT_MS \|\| 60_000/);
  assert.match(mediaImporter, /await response\.arrayBuffer\(\)/);
  assert.match(mediaImporter, /Skipping media body that timed out or failed/);
  assert.match(mediaImporter, /mediaCache\.set\(sourceHash, null\)/);
});
