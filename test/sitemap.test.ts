import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildSitemapXml } from "../src/lib/sitemap.ts";

test("builds valid escaped XML and removes duplicate locations", () => {
  const xml = buildSitemapXml("https://talkspace.ng/", [
    { path: "/blog/anxiety?source=a&format=full", priority: "0.6" },
    { path: "/blog/anxiety?source=a&format=full", priority: "0.6" },
  ]);

  assert.equal((xml.match(/<url>/g) ?? []).length, 1);
  assert.match(xml, /https:\/\/talkspace\.ng\/blog\/anxiety\?source=a&amp;format=full/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});

test("sitemap keeps canonical public paths and filters non-indexable CMS content", async () => {
  const source = await readFile(new URL("../src/routes/sitemap[.]xml.ts", import.meta.url), "utf8");

  assert.match(source, /PUBLIC_PAGE_CONFIG/);
  assert.match(source, /!publishedPages\.get\(entry\.contentSlug\)\?\.seo\.noindex/);
  assert.match(source, /!configuredPageSlugs\.has\(page\.slug\) && !page\.seo\.noindex/);
});

test("robots.txt advertises the submitted sitemap URL", async () => {
  const robots = await readFile(new URL("../public/robots.txt", import.meta.url), "utf8");
  assert.match(robots, /^Sitemap: https:\/\/talkspace\.ng\/sitemap\.xml$/m);
});
