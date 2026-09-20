import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const demoBookingSeedScript = await readFile(
  new URL("../scripts/seed-demo-bookings.mjs", import.meta.url),
  "utf8",
);
const demoContentSeedScript = await readFile(
  new URL("../scripts/seed-demo-content.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const demoClientSeedDoc = await readFile(
  new URL("../docs/DEMO_CLIENT_SEED.md", import.meta.url),
  "utf8",
);
const homeRoute = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const contentFunctions = await readFile(
  new URL("../src/lib/content.functions.ts", import.meta.url),
  "utf8",
);

test("documents and wires the full demo booking seed", () => {
  assert.match(packageJson.scripts["db:seed:demo"], /db:seed:clients/);
  assert.match(packageJson.scripts["db:seed:demo"], /seed-demo-bookings\.mjs/);
  assert.match(packageJson.scripts["db:seed:demo"], /db:seed:content/);
  assert.match(demoClientSeedDoc, /npm run db:seed:demo/);
  assert.match(demoBookingSeedScript, /TS-DEMO-BOOK-1001/);
  assert.match(demoBookingSeedScript, /TS-DEMO-BOOK-1002/);
  assert.match(demoBookingSeedScript, /TS-DEMO-BOOK-1003/);
  assert.match(demoBookingSeedScript, /TS-DEMO-BOOK-1004/);
  assert.match(demoBookingSeedScript, /TS-DEMO-BOOK-1005/);
  assert.match(demoBookingSeedScript, /TS-DEMO-BOOK-1006/);
  assert.match(demoBookingSeedScript, /TS-DEMO-PAY-1005/);
  assert.match(demoBookingSeedScript, /record_payment_initiated/);
  assert.match(demoBookingSeedScript, /submit_bank_transfer/);
  assert.match(demoBookingSeedScript, /mark_payment_status/);
  assert.match(demoContentSeedScript, /seed-demo-content/);
  assert.match(demoContentSeedScript, /demo-media-hero-1/);
  assert.match(demoContentSeedScript, /demo-homepage-builder/);
  assert.match(demoContentSeedScript, /about/);
  assert.match(demoContentSeedScript, /services/);
  assert.match(demoContentSeedScript, /pricing/);
  assert.match(demoContentSeedScript, /contact/);
  assert.match(demoContentSeedScript, /privacy-policy/);
  assert.match(demoContentSeedScript, /terms/);
  assert.match(demoContentSeedScript, /emergency-support/);
  assert.match(demoContentSeedScript, /cancellation-refund-policy/);
  assert.match(demoContentSeedScript, /faqs/);
  assert.match(demoContentSeedScript, /home_specialties/);
  assert.match(demoContentSeedScript, /google_reviews/);
  assert.match(demoContentSeedScript, /testimonials/);
  assert.match(demoContentSeedScript, /content_entries/);
  assert.match(demoContentSeedScript, /content_media/);
  assert.match(demoContentSeedScript, /content_entry_media/);
  assert.match(homeRoute, /getPublicHomepageData/);
  assert.match(
    homeRoute,
    /reviews:\s*\(\s*<Reviews\s+testimonials=\{testimonials\}\s+googleReviews=\{googleReviews\}\s+copy=\{live\.reviews\}\s*\/>\s*\)/,
  );
  assert.match(contentFunctions, /avatarUrl:\n\s+typeof r\.avatar_url/);
});
