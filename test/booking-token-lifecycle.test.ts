import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertCheckoutOpen,
  checkoutDeadline,
  isBookingTokenActive,
  CHECKOUT_WINDOW_MS,
} from "../src/lib/booking-token-lifecycle.ts";

const bookingPage = readFileSync("src/routes/book.tsx", "utf8");
const checkoutClockMigration = readFileSync(
  "supabase/migrations/20260916100000_booking_checkout_clock.sql",
  "utf8",
);
const checkoutGuardMigration = readFileSync(
  "supabase/migrations/20260916130000_restore_active_checkout_token_guard.sql",
  "utf8",
);

const created = Date.parse("2030-01-01T00:00:00Z");
const fresh = {
  status: "hold",
  created_at: new Date(created).toISOString(),
  hold_expires_at: new Date(created + CHECKOUT_WINDOW_MS).toISOString(),
  manage_token_expires_at: "2035-01-01T00:00:00Z",
};
test("checkout tokens expire at the original five-minute deadline including pending payments", () => {
  for (const row of [fresh, { ...fresh, status: "pending_payment", hold_expires_at: null }]) {
    assert.equal(checkoutDeadline(row), created + CHECKOUT_WINDOW_MS);
    assert.equal(isBookingTokenActive(row, created + CHECKOUT_WINDOW_MS - 1), true);
    assert.equal(isBookingTokenActive(row, created + CHECKOUT_WINDOW_MS), false);
    assert.throws(() => assertCheckoutOpen(row, created + CHECKOUT_WINDOW_MS), /expired/);
  }
});

test("expired payment holds cannot enter the pay-later confirmation state", () => {
  assert.match(bookingPage, /if \(expired\) \{/);
  assert.match(bookingPage, /This checkout has expired\. Start a new booking to continue/);
  assert.match(bookingPage, /disabled=\{expired \|\| paystackBusy \|\| bankBusy\}/);
  assert.match(bookingPage, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
});
test("payment countdown uses the server clock returned with a booking hold", () => {
  const clock = readFileSync("src/hooks/use-checkout-clock.ts", "utf8");
  assert.match(clock, /serverNow \? Date\.parse\(serverNow\)/);
  assert.match(clock, /Date\.now\(\) \+ serverOffset/);
  assert.match(bookingPage, /serverNow: group\.serverNow/);
  assert.match(bookingPage, /useCheckoutClock\(expiresAt, confirmation\.serverNow\)/);
});
test("database checkout clock is restricted to the service role", () => {
  assert.match(checkoutClockMigration, /booking_checkout_deadline\(appointment\)/);
  assert.match(checkoutClockMigration, /server_now timestamptz/);
  assert.match(
    checkoutClockMigration,
    /revoke all on function public\.get_booking_checkout_clock\(uuid\[\]\) from public, anon, authenticated/,
  );
  assert.match(
    checkoutClockMigration,
    /grant execute on function public\.get_booking_checkout_clock\(uuid\[\]\) to service_role/,
  );
});
test("active checkout tokens remain valid for holds and pending payments", () => {
  assert.match(checkoutGuardMigration, /status in \('hold', 'pending_payment'\)/);
  assert.match(checkoutGuardMigration, /booking_checkout_deadline\(p_appointment\) > now\(\)/);
  assert.match(checkoutGuardMigration, /status not in \('cancelled', 'completed', 'no_show'\)/);
  assert.match(
    checkoutGuardMigration,
    /grant execute on function public\.appointment_manage_token_is_active\(public\.appointments\)\s+to anon, authenticated, service_role/,
  );
});
test("missing or malformed checkout dates and closed or revoked tokens fail closed", () => {
  for (const changes of [
    { created_at: null },
    { created_at: "invalid" },
    { manage_token_expires_at: "invalid" },
    { status: "cancelled" },
    { status: "completed" },
    { status: "no_show" },
    { manage_token_revoked_at: "2030-01-01T00:00:00Z" },
  ]) {
    const row = { ...fresh, ...changes };
    assert.equal(isBookingTokenActive(row, created), false);
    assert.throws(() => assertCheckoutOpen(row, created));
  }
});
test("confirmed management is separate from checkout authority and earlier expiry wins", () => {
  const paid = { ...fresh, status: "confirmed", hold_expires_at: null };
  assert.equal(isBookingTokenActive(paid, created + CHECKOUT_WINDOW_MS), true);
  assert.throws(() => assertCheckoutOpen(paid, created), /closed/);
  assert.equal(isBookingTokenActive({ ...paid, manage_token_expires_at: null }, created), false);
  assert.equal(
    checkoutDeadline({
      ...fresh,
      manage_token_expires_at: new Date(created + 60000).toISOString(),
    }),
    created + 60000,
  );
});
test("every payment entry point checks checkout expiry before acting, including owners", () => {
  const source = readFileSync("src/lib/payments.functions.ts", "utf8");
  for (const name of ["initPaystackPayment", "uploadReceiptWithToken", "submitBankTransfer"]) {
    const start = source.indexOf(`export const ${name}`);
    const end = source.indexOf("\nexport const ", start + 1);
    const body = source.slice(start, end < 0 ? undefined : end);
    assert.match(body, /assertCheckoutOpen\(appt\)/, name);
    assert.match(body, /created_at, hold_expires_at/, name);
  }
  const page = readFileSync("src/routes/book.tsx", "utf8");
  assert.match(page, /disabled=\{expired \|\| paystackBusy/);
  assert.match(page, /disabled=\{expired \|\| bankBusy/);
  assert.match(page, /const startPaystack = async \(\) => \{\s*if \(expired\)/);
  assert.match(page, /const submitBank = async \(\) => \{\s*if \(expired\)/);
});
test("payment checkout is recoverable after a browser refresh without creating another hold", () => {
  const page = readFileSync("src/routes/book.tsx", "utf8");
  const callback = readFileSync("src/routes/book.payment-callback.tsx", "utf8");
  assert.match(page, /talk-space\.booking-checkout\.v1/);
  assert.match(page, /window\.sessionStorage\.setItem\(BOOKING_CHECKOUT_KEY/);
  assert.match(page, /window\.sessionStorage\.getItem\(BOOKING_CHECKOUT_KEY/);
  assert.match(page, /setStep\("pay"\)/);
  assert.match(page, /saveCheckoutSession\(savedConfirmation\)/);
  assert.match(page, /clearCheckoutSession\(\)/);
  assert.match(callback, /status === "succeeded"[\s\S]*talk-space\.booking-checkout\.v1/);
});
test("uncommitted changes do not send booking notices and late payments cannot activate packages", () => {
  const source = readFileSync("src/lib/booking.functions.ts", "utf8");
  assert.match(source, /if \(result.status !== "confirmed"\) return/);
  assert.match(source, /if \(before\?\.status !== "confirmed"\) return/);
  const email = readFileSync("src/lib/payment-email.server.ts", "utf8");
  assert.match(email, /params.templateKey === "payment_success" && !bookingNeedsReview/);
  assert.match(email, /bookingNeedsReview: bookingNeedsReview \? "yes"/);
});
