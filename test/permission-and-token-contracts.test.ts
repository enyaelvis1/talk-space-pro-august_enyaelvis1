import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bookingFunctions = await readFile(
  new URL("../src/lib/booking.functions.ts", import.meta.url),
  "utf8",
);
const paymentFunctions = await readFile(
  new URL("../src/lib/payments.functions.ts", import.meta.url),
  "utf8",
);
const manageTokenMigration = await readFile(
  new URL(
    "../supabase/migrations/20260810145500_manage_token_expiry_revocation.sql",
    import.meta.url,
  ),
  "utf8",
);
const holdStateMigration = await readFile(
  new URL(
    "../supabase/migrations/20260729160000_fix_booking_hold_insert_state.sql",
    import.meta.url,
  ),
  "utf8",
);
const bookingFoundation = await readFile(
  new URL("../supabase/migrations/20260715200000_booking_foundation.sql", import.meta.url),
  "utf8",
);

function exportBody(source: string, name: string) {
  const start = source.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} export not found`);
  const next = source.indexOf("\nexport const ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("admin booking and payment operations require an admin role check", () => {
  const requireAdminClient = bookingFunctions.slice(
    bookingFunctions.indexOf("async function requireAdminClient()"),
  );
  assert.match(requireAdminClient.slice(0, 1200), /auth\.getUser\(\)/);
  assert.match(requireAdminClient.slice(0, 1200), /throw new Error\("Sign in required\."\)/);
  assert.match(requireAdminClient.slice(0, 1200), /rpc\("has_role", \{/);
  assert.match(requireAdminClient.slice(0, 1200), /_role: "admin"/);
  assert.match(
    requireAdminClient.slice(0, 1200),
    /throw new Error\("Admin permission required\."\)/,
  );

  for (const name of [
    "listAppointmentsForAdmin",
    "getAdminAppointmentTimeline",
    "listUpcomingAppointmentsForAdmin",
    "listTodayAppointmentsForAdmin",
    "archiveAppointmentForAdmin",
    "deleteTemporaryAppointmentsForAdmin",
    "revokeAppointmentManageToken",
    "resendReminder",
  ]) {
    assert.match(exportBody(bookingFunctions, name).slice(0, 900), /requireAdminClient\(\)/, name);
  }
  const bulkDeleteBody = exportBody(bookingFunctions, "deleteTemporaryAppointmentsForAdmin");
  const archiveBody = exportBody(bookingFunctions, "archiveAppointmentForAdmin");
  assert.match(archiveBody, /archived_at/);
  assert.match(archiveBody, /archive_reason/);
  assert.match(bulkDeleteBody, /confirmation: z\.literal\("DELETE TEST BOOKINGS"\)/);
  assert.match(bulkDeleteBody, /status === "hold"/);
  assert.match(bulkDeleteBody, /status === "cancelled"/);
  assert.match(bulkDeleteBody, /"succeeded", "awaiting_confirmation"/);

  const requireAdmin = paymentFunctions.slice(
    paymentFunctions.indexOf("async function requireAdmin()"),
  );
  assert.match(requireAdmin.slice(0, 1200), /auth\.getUser\(\)/);
  assert.match(requireAdmin.slice(0, 1200), /throw new Error\("Sign in required\."\)/);
  assert.match(requireAdmin.slice(0, 1200), /rpc\("has_role", \{/);
  assert.match(requireAdmin.slice(0, 1200), /_role: "admin"/);
  assert.match(requireAdmin.slice(0, 1200), /throw new Error\("Admin permission required\."\)/);

  for (const name of [
    "getPaymentAdminData",
    "updatePaymentSettings",
    "setPaystackSecret",
    "clearPaystackSecret",
    "setPaystackWebhookSecret",
    "clearPaystackWebhookSecret",
    "listPaymentsForAdmin",
    "deletePaymentForAdmin",
    "verifyBankTransferPayment",
    "getReceiptSignedUrl",
    "listPaymentReviews",
    "listPaymentEvents",
  ]) {
    assert.match(exportBody(paymentFunctions, name).slice(0, 900), /requireAdmin\(\)/, name);
  }
});

test("manage-token access is throttled, hashed, and rejected when inactive", () => {
  const lookup = exportBody(bookingFunctions, "getAppointmentByManageToken");
  assert.match(lookup, /bucket: "manage_token_lookup"/);
  assert.match(lookup, /windowSeconds: 15 \* 60/);
  assert.match(lookup, /rpc\(\s*"get_appointment_by_manage_token"/);
  assert.match(lookup, /p_manage_token_hash: hashToken\(data\.manageToken\)/);

  const activePredicate = manageTokenMigration.slice(
    manageTokenMigration.indexOf(
      "create or replace function public.appointment_manage_token_is_active",
    ),
  );
  assert.match(activePredicate.slice(0, 900), /manage_token_hash is not null/);
  assert.match(activePredicate.slice(0, 900), /manage_token_revoked_at is null/);
  assert.match(activePredicate.slice(0, 900), /manage_token_expires_at > now\(\)/);
  assert.match(
    activePredicate.slice(0, 900),
    /status not in \('cancelled', 'completed', 'no_show'\)/,
  );

  const actor = manageTokenMigration.slice(
    manageTokenMigration.indexOf("create or replace function public.appointment_actor"),
  );
  assert.match(
    actor.slice(0, 900),
    /lower\(trim\(p_manage_token_hash\)\) = p_appointment\.manage_token_hash/,
  );
  assert.match(actor.slice(0, 900), /public\.appointment_manage_token_is_active\(p_appointment\)/);

  const sqlLookup = manageTokenMigration.slice(
    manageTokenMigration.indexOf(
      "create or replace function public.get_appointment_by_manage_token",
    ),
  );
  assert.match(
    sqlLookup.slice(0, 900),
    /a\.manage_token_hash = lower\(trim\(p_manage_token_hash\)\)/,
  );
  assert.match(sqlLookup.slice(0, 900), /public\.appointment_manage_token_is_active\(a\)/);
});

test("payment and booking mutations only accept active manage tokens or owners", () => {
  const tokenGuard = paymentFunctions.slice(
    paymentFunctions.indexOf("function hasActiveManageToken"),
  );
  assert.match(tokenGuard.slice(0, 900), /if \(!token\) return false/);
  assert.match(tokenGuard.slice(0, 900), /hashToken\(token\) !== row\.manage_token_hash/);
  assert.match(tokenGuard.slice(0, 900), /isBookingTokenActive\(row\)/);

  const initPaystack = exportBody(paymentFunctions, "initPaystackPayment");
  assert.match(
    initPaystack,
    /client_id, manage_token_hash, manage_token_expires_at, manage_token_revoked_at/,
  );
  assert.match(initPaystack, /const ownsAppt = user && appt\.client_id === user\.id/);
  assert.match(initPaystack, /manageTokens/);
  assert.match(initPaystack, /const groupToken = data\.manageTokens\?\.find/);
  assert.match(
    initPaystack,
    /data\.appointmentId \? data\.manageToken : groupToken\?\.manageToken/,
  );
  assert.match(initPaystack, /if \(!ownsAppt && !tokenMatch\)/);

  const uploadReceipt = exportBody(paymentFunctions, "uploadReceiptWithToken");
  assert.match(
    uploadReceipt,
    /client_id, manage_token_hash, manage_token_expires_at, manage_token_revoked_at/,
  );
  assert.match(uploadReceipt, /const ownsAppt = user && appt\.client_id === user\.id/);
  assert.match(uploadReceipt, /const tokenMatch = hasActiveManageToken\(appt, data\.manageToken\)/);
  assert.match(uploadReceipt, /if \(!ownsAppt && !tokenMatch\)/);

  const bankTransfer = exportBody(paymentFunctions, "submitBankTransfer");
  assert.match(bankTransfer, /manageTokens/);
  assert.match(bankTransfer, /hasActiveManageToken\(appt as ManageTokenLifecycle, token\)/);

  for (const name of ["rescheduleAppointment", "cancelAppointment"]) {
    const body = exportBody(bookingFunctions, name);
    assert.match(
      body,
      /p_manage_token_hash: data\.manageToken \? hashToken\(data\.manageToken\) : null/,
      name,
    );
  }
});

test("expired holds are removed from availability and revoke their manage links", () => {
  assert.match(
    bookingFoundation,
    /appointment\.status in \('hold', 'pending_payment', 'confirmed'\)/,
  );
  assert.match(
    bookingFoundation,
    /appointment\.status <> 'hold' or appointment\.hold_expires_at > now\(\)/,
  );

  assert.match(holdStateMigration, /where public\.appointments\.status = 'hold'/);
  assert.match(holdStateMigration, /public\.appointments\.hold_expires_at <= now\(\)/);

  const expireSql = manageTokenMigration.slice(
    manageTokenMigration.indexOf("create or replace function public.expire_stale_holds"),
  );
  assert.match(expireSql.slice(0, 1200), /status = 'cancelled'/);
  assert.match(expireSql.slice(0, 1200), /hold_expires_at = null/);
  assert.match(expireSql.slice(0, 1200), /manage_token = null/);
  assert.match(expireSql.slice(0, 1200), /manage_token_revoked_at = coalesce/);
  assert.match(expireSql.slice(0, 1200), /'hold_expired'/);

  const expireServerFn = exportBody(bookingFunctions, "expireStaleHolds");
  assert.match(expireServerFn, /rpc\("expire_stale_holds"\)/);
});
