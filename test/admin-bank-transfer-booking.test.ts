import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260921150000_fix_admin_booking_id_ambiguity.sql",
    import.meta.url,
  ),
  "utf8",
);

test("admin booking RPC qualifies id references for confirmed bank transfers", () => {
  assert.match(migration, /create or replace function public\.create_admin_appointment/);
  assert.match(migration, /public\.services\.id = p_service_id/);
  assert.match(migration, /public\.therapists\.id = p_therapist_id/);
  assert.match(migration, /public\.clients\.id = p_client_id/);
  assert.match(migration, /public\.client_session_packages\.id = p_package_id/);
  assert.match(migration, /public\.appointments\.id = appointment_id/);
  assert.match(migration, /p_payment_method not in \('bank_transfer', 'paystack'\)/);
  assert.match(migration, /payment_status_value = 'succeeded'/);
});
