import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminFunctions = await readFile(
  new URL("../src/lib/admin.functions.ts", import.meta.url),
  "utf8",
);
const contentFunctions = await readFile(
  new URL("../src/lib/content.functions.ts", import.meta.url),
  "utf8",
);
const editor = await readFile(
  new URL("../src/routes/_authenticated.admin.content.$id.edit.tsx", import.meta.url),
  "utf8",
);
const lifecycleControls = await readFile(
  new URL("../src/components/admin/ContentLifecycleControls.tsx", import.meta.url),
  "utf8",
);
const revisions = await readFile(
  new URL("../src/components/admin/RevisionHistoryButton.tsx", import.meta.url),
  "utf8",
);
const publicPagesConfig = await readFile(
  new URL("../src/lib/public-pages.ts", import.meta.url),
  "utf8",
);
const pageSections = await readFile(
  new URL("../src/lib/page-sections.ts", import.meta.url),
  "utf8",
);
const liveSections = await readFile(
  new URL("../src/components/site/sections/LiveSections.tsx", import.meta.url),
  "utf8",
);
const sectionRenderer = await readFile(
  new URL("../src/components/site/sections/SectionRenderer.tsx", import.meta.url),
  "utf8",
);
const sectionSettings = await readFile(
  new URL("../src/components/admin/SectionSettings.tsx", import.meta.url),
  "utf8",
);
const pricingCardImages = await readFile(
  new URL("../src/lib/pricing-card-images.ts", import.meta.url),
  "utf8",
);
const seedContent = await readFile(
  new URL("../src/lib/page-seed-content.ts", import.meta.url),
  "utf8",
);
const googleReviewsAdminRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.google-reviews.tsx", import.meta.url),
  "utf8",
);
const homeRoute = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");

function handlerBody(name: string): string {
  const start = adminFunctions.indexOf(`export const ${name} =`);
  assert.notEqual(start, -1, `${name} should be exported`);
  const next = adminFunctions.indexOf("\nexport const ", start + 1);
  return adminFunctions.slice(start, next === -1 ? undefined : next);
}

test("CMS content mutations require an authenticated admin", () => {
  assert.match(adminFunctions, /async function requireAdmin\(\)/);
  assert.match(adminFunctions, /bag\.client\.auth\.getUser\(\)/);
  assert.match(adminFunctions, /bag\.client\.rpc\("has_role"/);
  assert.match(adminFunctions, /_role: "admin"/);

  for (const name of [
    "createContentEntry",
    "updateContentFields",
    "updateContentBody",
    "setContentStatus",
    "bulkSetContentStatus",
    "bulkDeleteContent",
    "scheduleContentPublish",
    "setContentArchived",
    "restoreContentRevision",
  ]) {
    assert.match(handlerBody(name), /const bag = await requireAdmin\(\)/, name);
  }
});

test("CMS lifecycle operations cover draft, publish, archive, restore, and delete", () => {
  assert.match(handlerBody("createContentEntry"), /source_status: "draft"/);
  assert.match(handlerBody("updateContentFields"), /\.from\("content_entries"\)/);
  assert.match(handlerBody("updateContentBody"), /body_html/);
  assert.match(handlerBody("setContentStatus"), /status: z\.enum\(\["publish", "draft"\]\)/);
  assert.match(handlerBody("setContentStatus"), /published_at/);
  assert.match(handlerBody("bulkDeleteContent"), /\.delete\(\{ count: "exact" \}\)/);
  assert.match(handlerBody("setContentArchived"), /archived_at/);
  assert.match(handlerBody("setContentArchived"), /archived_by/);
  assert.match(handlerBody("setContentArchived"), /archived: z\.boolean\(\)/);
  assert.match(handlerBody("restoreContentRevision"), /restore_content_revision/);
  assert.match(revisions, /Restore this revision/);
  assert.match(revisions, /restoreContentRevision\(\{ data: \{ revisionId: r\.id \} \}\)/);
  assert.match(lifecycleControls, /Move to archive/);
  assert.match(lifecycleControls, /Restore from archive/);
});

test("published public content excludes archived entries", () => {
  const publishedQueries =
    contentFunctions.match(
      /\.eq\("source_status", "publish"\)[\s\S]{0,180}\.is\("archived_at", null\)/g,
    ) ?? [];
  assert.ok(
    publishedQueries.length >= 5,
    "public page, post, category, FAQ, and related queries should hide archived entries",
  );
});

test("content editor exposes body editing and revision history", () => {
  assert.match(editor, /updateContentBody/);
  assert.match(editor, /RevisionHistoryButton/);
  assert.match(editor, /Save changes/);
});

test("page builder exposes draft, publish, and version rollback", async () => {
  const builder = await readFile(
    new URL("../src/components/admin/PageBuilder.tsx", import.meta.url),
    "utf8",
  );
  assert.match(builder, /save\("draft"\)/);
  assert.match(builder, /save\("publish"\)/);
  assert.match(builder, /Throw away unpublished edits/);
  assert.match(builder, /desktop: \{ label: "Desktop", width: "1180px"/);
  assert.match(builder, /maxWidth: device === "desktop" \? undefined : "100%"/);
  assert.match(builder, /xl:grid-cols-\[300px_minmax\(0,1fr\)\]/);

  assert.match(builder, /RevisionHistoryButton/);
  assert.match(builder, /entityType="content_entry"/);

  const publicPages = await readFile(
    new URL("../src/routes/_authenticated.admin.public-pages.tsx", import.meta.url),
    "utf8",
  );
  assert.match(publicPages, /onRestored=\{\(\) => void reload\(entry\.id\)\}/);
});

test("public page editor exposes core pages, metadata, and live therapist sections", async () => {
  const publicPages = await readFile(
    new URL("../src/routes/_authenticated.admin.public-pages.tsx", import.meta.url),
    "utf8",
  );

  for (const route of ["/services", "/therapists", "/pricing", "/about", "/contact"]) {
    assert.match(publicPagesConfig, new RegExp(`route: "${route}"`), route);
  }

  assert.match(publicPages, /RichTextEditor/);
  assert.match(publicPages, /PageBuilder/);
  assert.match(publicPages, /Page title/);
  assert.match(publicPages, /URL/);
  assert.match(publicPages, /Intro \/ summary/);
  assert.match(publicPages, /Featured image/);
  assert.match(publicPages, /Search &amp; social \(SEO\)/);
  assert.match(publicPages, /Save &amp; publish/);
  assert.match(publicPages, /scheduleContentPublish/);

  assert.match(pageSections, /type: z\.literal\("therapistList"\)/);
  assert.match(pageSections, /Therapist profiles \(live\)/);
  assert.match(liveSections, /getPublicTherapists/);
  assert.match(liveSections, /LiveTherapistList/);
  assert.match(sectionRenderer, /case "therapistList"/);
  assert.match(seedContent, /therapists:/);
  assert.match(seedContent, /type: "therapistList"/);
});

test("pricing cards render default images when no custom image is selected", () => {
  assert.match(pricingCardImages, /PRICING_CARD_IMAGE_BY_ID/);
  assert.match(pricingCardImages, /function pricingCardImage\(card: SectionCard\)/);
  assert.match(pricingCardImages, /card\.image\.src\.trim\(\)/);
  assert.match(
    sectionRenderer,
    /const image = isPricingCardGrid \? pricingCardImage\(card\) : card\.image/,
  );
  assert.match(sectionSettings, /previewSrcOverride \?\? resolveImageSrc\(src\)/);
  assert.match(sectionSettings, /section\.id\.startsWith\("pricing-"\)/);
  assert.match(sectionSettings, /src=\{card\.image\.src\}/);
  assert.match(sectionSettings, /previewSrc=\{resolveImageSrc\(image\.src\) \?\? undefined\}/);
});

test("Google review settings support persisted review entries and admin management", () => {
  assert.match(adminFunctions, /googleReviewEntrySchema|reviews: z\.array\(/);
  assert.match(adminFunctions, /reviewUrl: z\.string\(\)\.trim\(\)\.url\(\)\.max\(1000\)/);
  assert.match(adminFunctions, /googlePlaceId: z\.string\(\)\.trim\(\)\.max\(240\)/);
  assert.match(adminFunctions, /refreshGoogleReviewsWithClient/);
  assert.match(adminFunctions, /reviews: mergedReviews\.slice\(0, 2000\)/);
  assert.match(adminFunctions, /id: `google:\$\{name\}\|\$\{quote\}`/);
  assert.match(adminFunctions, /GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN/);
  assert.match(adminFunctions, /GOOGLE_PLACES_API_KEY/);
  assert.match(adminFunctions, /avatarPath/);
  assert.match(contentFunctions, /avatarUrl/);
  assert.match(homeRoute, /avatar: review\.avatarUrl/);
  assert.match(homeRoute, /data-review-avatar="initials"/);
  assert.match(adminFunctions, /currently looks like a Google Place ID/);
  assert.match(adminFunctions, /Could not reach Google Places from the server/);
  assert.doesNotMatch(adminFunctions, /import\("playwright-core"\)/);
  assert.doesNotMatch(adminFunctions, /npx playwright install chromium/i);
  assert.match(contentFunctions, /googleReviews\.reviews|reviewEntries|reviews:\s*\[/);
  assert.match(googleReviewsAdminRoute, /Add review|Import now|Google Place ID|Last sync/i);
  assert.match(homeRoute, /reviews-carousel/);
  assert.match(homeRoute, /data-review-group/);
  assert.match(homeRoute, /data-review-slide="true"/);
});
