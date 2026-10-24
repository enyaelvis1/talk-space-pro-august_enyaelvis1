import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DIASPORA_CHECKOUT_COPY,
  normalizeCheckoutCurrencyCopy,
  normalizeCheckoutCurrencySections,
} from "../src/lib/checkout-copy.ts";
import type { PageSection } from "../src/lib/page-sections.ts";

const legacy =
  "Yes. USD equivalents are shown for each plan and you can pay in either currency via Paystack.";

test("known legacy saved CMS promise describes NGN checkout without changing records", () => {
  const sections: PageSection[] = [
    {
      id: "pricing-faq",
      type: "faq",
      hidden: false,
      surface: "page",
      spacing: "md",
      width: "content",
      align: "left",
      eyebrow: "",
      heading: "Billing",
      body: "",
      items: [{ id: "diaspora", question: "Diaspora pricing?", answer: legacy }],
    },
  ];
  const original = structuredClone(sections);
  const result = normalizeCheckoutCurrencySections(sections);
  assert.equal(result[0].type, "faq");
  if (result[0].type === "faq") assert.equal(result[0].items[0].answer, DIASPORA_CHECKOUT_COPY);
  assert.deepEqual(sections, original);
  assert.notStrictEqual(result, sections);
  assert.match(DIASPORA_CHECKOUT_COPY, /Nigerian naira \(NGN\)/);
  assert.match(DIASPORA_CHECKOUT_COPY, /indicative only/);
});

test("legacy body copy and whitespace variants normalize idempotently", () => {
  assert.equal(
    normalizeCheckoutCurrencyCopy(`<p>${legacy}</p>`),
    `<p>${DIASPORA_CHECKOUT_COPY}</p>`,
  );
  assert.equal(
    normalizeCheckoutCurrencyCopy(legacy.replace("USD equivalents", "USD\n equivalents")),
    DIASPORA_CHECKOUT_COPY,
  );
  assert.equal(normalizeCheckoutCurrencyCopy(DIASPORA_CHECKOUT_COPY), DIASPORA_CHECKOUT_COPY);
  assert.equal(
    normalizeCheckoutCurrencyCopy("Contact us about diaspora pricing."),
    "Contact us about diaspora pricing.",
  );
});

test("fallbacks and public CMS read paths apply the same currency truth", () => {
  const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const pricing = read("src/routes/pricing.tsx");
  const seed = read("src/lib/page-seed-content.ts");
  assert.doesNotMatch(pricing + seed, /pay in either currency via Paystack/);
  assert.match(pricing, /a: DIASPORA_CHECKOUT_COPY/);
  assert.match(seed, /answer: DIASPORA_CHECKOUT_COPY/);
  assert.match(pricing, /normalizeCheckoutCurrencySections\(entry\.sections\)/);
  assert.match(pricing, /normalizeCheckoutCurrencySections\(entry\.draftSections\)/);
  assert.match(
    read("src/lib/content.functions.ts"),
    /answer: normalizeCheckoutCurrencyCopy\(row\.answer\)/,
  );
  const payments = read("src/lib/payments.functions.ts");
  assert.ok((payments.match(/currency: "NGN"/g) ?? []).length >= 2);
});
