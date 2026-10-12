import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaystackCallbackUrl,
  normalizePaystackCallbackPath,
} from "../src/lib/paystack-callback.ts";

test("normalizes a legacy webhook setting for the admin display", () => {
  assert.equal(
    normalizePaystackCallbackPath("https://www.talkspace.ng/api/public/paystack-webhook"),
    "/book/payment-callback",
  );
});

test("builds the customer callback from a relative path", () => {
  assert.equal(
    buildPaystackCallbackUrl({
      origin: "https://talkspace.ng",
      callbackPath: "/book/payment-callback",
      reference: "TSP-1",
    }),
    "https://talkspace.ng/book/payment-callback?reference=TSP-1&trxref=TSP-1",
  );
});
test("does not concatenate an absolute legacy URL into the origin", () => {
  assert.equal(
    buildPaystackCallbackUrl({
      origin: "https://talkspace.ng",
      callbackPath: "https://www.talkspace.ng/book/payment-callback",
      reference: "TSP-2",
    }),
    "https://talkspace.ng/book/payment-callback?reference=TSP-2&trxref=TSP-2",
  );
});

test("redirects legacy webhook callback settings to the customer callback", () => {
  assert.equal(
    buildPaystackCallbackUrl({
      origin: "https://talkspace.ng",
      callbackPath: "https://www.talkspace.ng/api/public/paystack-webhook",
      reference: "TSP-3",
    }),
    "https://talkspace.ng/book/payment-callback?reference=TSP-3&trxref=TSP-3",
  );
});

test("rejects callback URLs on an unrelated host", () => {
  assert.throws(
    () =>
      buildPaystackCallbackUrl({
        origin: "https://talkspace.ng",
        callbackPath: "https://attacker.example/callback",
        reference: "TSP-4",
      }),
    /application origin/,
  );
});
