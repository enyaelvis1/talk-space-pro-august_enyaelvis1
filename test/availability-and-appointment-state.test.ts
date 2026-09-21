import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bookingFoundation = await readFile(
  new URL("../supabase/migrations/20260715200000_booking_foundation.sql", import.meta.url),
  "utf8",
);
const holdInsertStateMigration = await readFile(
  new URL(
    "../supabase/migrations/20260729160000_fix_booking_hold_insert_state.sql",
    import.meta.url,
  ),
  "utf8",
);
const holdStateMigration = await readFile(
  new URL(
    "../supabase/migrations/20260729103000_reconcile_appointment_hold_state.sql",
    import.meta.url,
  ),
  "utf8",
);
const appointmentStateMigration = await readFile(
  new URL(
    "../supabase/migrations/20260718050409_8f1523d8-724c-41b6-bdab-2406bbe2b7df.sql",
    import.meta.url,
  ),
  "utf8",
);
const rescheduleCancelMigration = await readFile(
  new URL("../supabase/migrations/20260902113000_align_booking_change_window.sql", import.meta.url),
  "utf8",
);
const bookingFunctions = await readFile(
  new URL("../src/lib/booking.functions.ts", import.meta.url),
  "utf8",
);
const bookingRoute = await readFile(new URL("../src/routes/book.tsx", import.meta.url), "utf8");
const manageTokenLifecycleMigration = await readFile(
  new URL(
    "../supabase/migrations/20260810145500_manage_token_expiry_revocation.sql",
    import.meta.url,
  ),
  "utf8",
);

test("availability generation honors active services, windows, buffers, and occupied slots", () => {
  assert.match(bookingFoundation, /create or replace function public\.list_available_slots/);
  assert.match(
    bookingFoundation,
    /selected_service[\s\S]*where id = p_service_id[\s\S]*and is_active/,
  );
  assert.match(bookingFoundation, /generate_series\(p_from, p_to, interval '1 day'\)/);
  assert.match(bookingFoundation, /join public\.therapist_services assignment/);
  assert.match(bookingFoundation, /therapist\.is_active/);
  assert.match(bookingFoundation, /recurring_windows/);
  assert.match(bookingFoundation, /added_windows/);
  assert.match(bookingFoundation, /exception\.kind = 'added'/);
  assert.match(bookingFoundation, /interval '15 minutes'/);
  assert.match(bookingFoundation, /selected_service\.duration_minutes/);
  assert.match(bookingFoundation, /minimum_lead_time_minutes/);
  assert.match(bookingFoundation, /blocked\.kind = 'blocked'/);
  assert.match(bookingFoundation, /candidate\.buffer_before_minutes/);
  assert.match(bookingFoundation, /candidate\.buffer_after_minutes/);
  assert.match(
    bookingFoundation,
    /appointment\.status in \('hold', 'pending_payment', 'confirmed'\)/,
  );
  assert.match(
    bookingFoundation,
    /appointment\.status <> 'hold' or appointment\.hold_expires_at > now\(\)/,
  );
});

test("hold creation writes explicit hold state and expires stale holds", () => {
  assert.match(holdInsertStateMigration, /alter column status set default 'hold'/);
  assert.match(
    holdInsertStateMigration,
    /p_client_id is not null[\s\S]*p_client_id <> auth\.uid\(\)/,
  );
  assert.match(holdInsertStateMigration, /message = 'invalid_client'/);
  assert.match(
    holdInsertStateMigration,
    /extract\(minute from \(p_starts_at at time zone 'Africa\/Lagos'\)\)::integer % 15 <> 0/,
  );
  assert.match(holdInsertStateMigration, /from public\.list_available_slots/);
  assert.match(holdInsertStateMigration, /message = 'slot_unavailable'/);
  assert.match(holdInsertStateMigration, /status,\s*hold_expires_at/);
  assert.match(holdInsertStateMigration, /'hold',\s*now\(\) \+ interval '5 minutes'/);
  assert.match(holdInsertStateMigration, /where public\.appointments\.status = 'hold'/);
  assert.match(holdInsertStateMigration, /public\.appointments\.hold_expires_at <= now\(\)/);

  assert.match(
    holdStateMigration,
    /create or replace function public\.normalize_appointment_hold_state/,
  );
  assert.match(holdStateMigration, /if new\.status = 'hold' then/);
  assert.match(holdStateMigration, /new\.hold_expires_at := now\(\) \+ interval '5 minutes'/);
  assert.match(holdStateMigration, /new\.hold_expires_at := null/);
});

test("booking holds reuse existing profiles without creating unpaid client records", () => {
  assert.match(bookingFunctions, /async function ensureBookingClientProfile/);
  assert.match(bookingFunctions, /from\("clients"\)[\s\S]*select\("id"\)/);
  const profileStart = bookingFunctions.indexOf("async function ensureBookingClientProfile");
  const profileEnd = bookingFunctions.indexOf("\nexport type HeldAppointment", profileStart);
  assert.ok(profileStart >= 0 && profileEnd > profileStart);
  assert.doesNotMatch(bookingFunctions.slice(profileStart, profileEnd), /\.upsert\(/);
  assert.match(bookingFunctions, /const clientId = await ensureBookingClientProfile/);
  assert.match(bookingFunctions, /p_client_id: clientId/);
  assert.match(bookingFunctions, /client_id: clientId/);
});

test("multi-therapist same-time slots keep therapist identity distinct", () => {
  assert.match(bookingFunctions, /therapistName: therapistNames\.get/);
  assert.match(bookingFunctions, /therapistId: slot\.therapist_id/);
  assert.match(bookingRoute, /slotKey\(slot\) !== slotId/);
});

test("appointment state transitions reject unsafe states and clear hold metadata", () => {
  assert.match(
    rescheduleCancelMigration,
    /create or replace function public\.reschedule_appointment/i,
  );
  assert.match(
    rescheduleCancelMigration,
    /appt\.status not in \('hold','pending_payment','confirmed'\)/i,
  );
  assert.match(rescheduleCancelMigration, /message = 'invalid_state'/);
  assert.match(
    rescheduleCancelMigration,
    /actor in \('client_owner','manage_token'\)[\s\S]*interval '48 hours'/i,
  );
  assert.match(rescheduleCancelMigration, /message = 'too_late'/);
  assert.match(rescheduleCancelMigration, /update public\.appointments set status = 'cancelled'/i);
  assert.match(rescheduleCancelMigration, /rescheduled_from_starts_at = coalesce/);
  assert.match(
    rescheduleCancelMigration,
    /hold_expires_at = case when appt\.status = 'hold' then now\(\) \+ interval '5 minutes' else null end/i,
  );

  assert.match(rescheduleCancelMigration, /create or replace function public\.cancel_appointment/i);
  assert.match(rescheduleCancelMigration, /appt\.status in \('cancelled','completed','no_show'\)/i);
  assert.match(rescheduleCancelMigration, /status = 'cancelled'/);
  assert.match(rescheduleCancelMigration, /cancelled_at = now\(\)/);
  assert.match(rescheduleCancelMigration, /cancel_reason = nullif\(trim\(p_reason\), ''\)/);
  assert.match(rescheduleCancelMigration, /hold_expires_at = null/i);

  assert.match(
    appointmentStateMigration,
    /create or replace function public\.mark_appointment_status/i,
  );
  assert.match(appointmentStateMigration, /public\.has_role\(auth\.uid\(\), 'admin'\)/);
  assert.match(appointmentStateMigration, /public\.has_role\(auth\.uid\(\), 'staff'\)/);
  assert.match(appointmentStateMigration, /p_new_status not in \('completed','no_show'\)/i);
  assert.match(appointmentStateMigration, /appt\.status not in \('confirmed','pending_payment'\)/i);
  assert.match(appointmentStateMigration, /status = p_new_status/);
});

test("rescheduling the same committed slot is an idempotent no-op", async () => {
  const retryMigration = await readFile(
    new URL(
      "../supabase/migrations/20260921200000_idempotent_reschedule_retry.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(retryMigration, /appt\.status = 'confirmed'/i);
  assert.match(retryMigration, /appt\.starts_at = p_new_starts_at/i);
  assert.match(retryMigration, /RETURN NEXT;\s+RETURN;/i);
  assert.match(
    retryMigration,
    /without changing its timestamp, timeline, slot, or notification state/i,
  );
});

test("manage-token lifecycle revokes access for terminal appointment states", () => {
  assert.match(manageTokenLifecycleMigration, /appointment_manage_token_is_active/);
  assert.match(manageTokenLifecycleMigration, /manage_token_revoked_at is null/);
  assert.match(manageTokenLifecycleMigration, /manage_token_expires_at > now\(\)/);
  assert.match(
    manageTokenLifecycleMigration,
    /status not in \('cancelled', 'completed', 'no_show'\)/,
  );
  assert.match(manageTokenLifecycleMigration, /apply_appointment_manage_token_lifecycle/);
  assert.match(manageTokenLifecycleMigration, /new\.status in \('completed', 'no_show'\)/);
  assert.match(manageTokenLifecycleMigration, /'status_' \|\| new\.status::text/);
  assert.match(
    manageTokenLifecycleMigration,
    /actor := public\.appointment_actor\(appt, p_manage_token_hash\)/,
  );
  assert.match(manageTokenLifecycleMigration, /manage_token = null/);
  assert.match(manageTokenLifecycleMigration, /'status_cancelled'/);
  assert.match(manageTokenLifecycleMigration, /'hold_expired'/);
  assert.match(
    manageTokenLifecycleMigration,
    /and public\.appointment_manage_token_is_active\(a\)/,
  );
});
