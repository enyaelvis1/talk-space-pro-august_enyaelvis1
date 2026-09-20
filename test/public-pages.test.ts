import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSection, type PageSection } from "../src/lib/page-sections.ts";
import {
  getPublicPageConfig,
  PUBLIC_PAGE_CONFIG,
  resolvePublicPageSlug,
} from "../src/lib/public-pages.ts";

test("maps public routes to editable page slugs", () => {
  assert.equal(resolvePublicPageSlug("/about"), "about");
  assert.equal(resolvePublicPageSlug("/services"), "services");
  assert.equal(resolvePublicPageSlug("/therapists"), "therapists");
  assert.equal(resolvePublicPageSlug("/pricing"), "pricing");
  assert.equal(resolvePublicPageSlug("/contact"), "contact");
  assert.equal(resolvePublicPageSlug("/unknown"), null);
});

test("builds route metadata for editable public pages", () => {
  assert.deepEqual(getPublicPageConfig("/about"), {
    key: "about",
    label: "About",
    route: "/about",
    contentSlug: "about",
  });
  assert.deepEqual(getPublicPageConfig("privacy-policy"), {
    key: "privacy-policy",
    label: "Privacy policy",
    route: "/privacy-policy",
    contentSlug: "privacy-policy",
  });
  assert.equal(getPublicPageConfig("/unknown"), null);
});

test("admin-managed public pages cover the core public navigation routes", () => {
  const routes = new Set(PUBLIC_PAGE_CONFIG.map((page) => page.route));
  for (const route of ["/services", "/therapists", "/pricing", "/about", "/contact"]) {
    assert.ok(routes.has(route), `${route} should be editable from Admin -> Public pages`);
  }
});

test("therapist list sections expose a configurable column count", () => {
  const therapistSection = createSection("therapistList") as PageSection & { columns?: number };

  assert.equal(therapistSection.type, "therapistList");
  assert.equal(therapistSection.columns, 3);
  assert.ok(Number.isInteger(therapistSection.columns));
});

test("core public routes check for a published page entry before rendering fallback content", async () => {
  for (const [route, file] of [
    ["/about", "about.tsx"],
    ["/services", "services.tsx"],
    ["/therapists", "therapists.tsx"],
    ["/pricing", "pricing.tsx"],
    ["/contact", "contact.tsx"],
  ] as const) {
    const source = await readFile(new URL(`../src/routes/${file}`, import.meta.url), "utf8");
    assert.match(source, /getPublishedEntry\(\{ data: \{ kind: "page"/, route);
    assert.match(source, /EditablePublicPage/, route);
    assert.match(source, /AdminPageEditLayer/, route);
  }
});
