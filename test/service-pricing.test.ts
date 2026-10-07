import assert from "node:assert/strict";
import test from "node:test";

import { resolveServicePriceNgn } from "../src/lib/service-pricing.ts";

test("admin package pricing uses the configured in-person price", () => {
  const service = {
    code: "individual",
    price_ngn: 55000,
    in_person_price_ngn: 85000,
  };

  assert.equal(resolveServicePriceNgn(service, "online"), 55000);
  assert.equal(resolveServicePriceNgn(service, "in_person"), 85000);
});

test("in-person pricing falls back by service code without inheriting online price", () => {
  assert.equal(
    resolveServicePriceNgn(
      { code: "individual", price_ngn: 55000, in_person_price_ngn: null },
      "in_person",
    ),
    85000,
  );
});
