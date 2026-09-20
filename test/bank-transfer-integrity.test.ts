import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260913130000_harden_bank_transfer_commitment.sql",
    import.meta.url,
  ),
  "utf8",
);
const paymentFunctions = await readFile(
  new URL("../src/lib/payments.functions.ts", import.meta.url),
  "utf8",
);
const bookingRoute = await readFile(new URL("../src/routes/book.tsx", import.meta.url), "utf8");

test("bank-transfer commitment validates stored pricing and preserves terminal replays", () => {
  assert.match(migration, /expected_amount_kobo bigint/);
  assert.match(migration, /in_person_price_ngn/);
  assert.match(migration, /p_amount_kobo <> expected_amount_kobo/);
  assert.match(migration, /transfer_reference_required/);
  assert.match(migration, /status in \('succeeded', 'refunded'\) then public\.payments\.status/);
  assert.match(migration, /grant execute on function public\.submit_bank_transfer/);
  assert.match(paymentFunctions, /transferReference: z\.string\(\)\.trim\(\)\.min\(1/);
  assert.doesNotMatch(
    paymentFunctions,
    /transferReference: z\.string\(\)\.trim\(\)\.max\(200\)\.optional/,
  );
  assert.match(bookingRoute, /Transfer reference<\/Label>/);
  assert.match(bookingRoute, /id="bank-ref"[\s\S]*required/);
});
