import assert from "node:assert/strict";
import test from "node:test";

import { orderFaqCategories, parseFaqCategoryOrder } from "../src/lib/faq-category-order.ts";

test("preferred FAQ category order is preserved and newly added categories remain visible", () => {
  assert.deepEqual(
    orderFaqCategories(["Fees & access", "Getting started", "New category"], ["Getting started"]),
    ["Getting started", "Fees & access", "New category"],
  );
});

test("FAQ category ordering ignores duplicates and unavailable categories", () => {
  assert.deepEqual(orderFaqCategories(["B", "A"], ["A", "A", "Missing"]), ["A", "B"]);
});

test("stored FAQ category order accepts only bounded non-empty strings", () => {
  assert.deepEqual(parseFaqCategoryOrder([" Fees ", "", 3, "A".repeat(121), "B"]), [" Fees ", "B"]);
  assert.deepEqual(parseFaqCategoryOrder({ categories: ["A"] }), []);
});
