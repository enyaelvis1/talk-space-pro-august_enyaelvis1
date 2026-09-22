import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatWATDateTime, formatWATTime, APP_TIME_ZONE } from "../src/lib/time.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("operational timestamps use the West African Time contract", () => {
  assert.equal(APP_TIME_ZONE, "Africa/Lagos");
  assert.match(formatWATDateTime("2026-09-22T10:30:00.000Z"), /11:30/);
  assert.match(formatWATDateTime("2026-09-22T23:30:00.000Z"), /00:30/);
  assert.match(formatWATTime("2026-09-22T10:30:00.000Z"), /11:30/);
});

test("admin client assignment offers active therapists and validates the selection", () => {
  const clients = read("src/lib/clients.functions.ts");
  const detail = read("src/components/admin/AdminClientDetail.tsx");
  const route = read("src/routes/_authenticated.admin.clients.$clientId.tsx");
  assert.match(clients, /assignedTherapistId/);
  assert.match(clients, /is_active/);
  assert.match(clients, /Choose an active therapist/);
  assert.match(clients, /therapistsResult/);
  assert.match(detail, /Assigned therapist/);
  assert.match(detail, /Changes the client’s default therapist/);
  assert.match(route, /therapists/);
});

test("client assignment changes are included in the immutable audit trigger", () => {
  const migration = read("supabase/migrations/20260922120000_audit_client_assignment_changes.sql");
  assert.match(migration, /public\.clients/);
  assert.match(migration, /public\.capture_admin_audit_log/);
  assert.match(migration, /clients_audit_log/);
});

test("specific booking therapist changes continue through the availability-validated reschedule flow", () => {
  const booking = read("src/routes/_authenticated.admin.bookings.tsx");
  const sql = read("supabase/migrations/20260718050409_8f1523d8-724c-41b6-bdab-2406bbe2b7df.sql");
  assert.match(booking, /newTherapistId: selectedSlot\.therapistId/);
  assert.match(sql, /p_new_therapist_id uuid/);
  assert.match(sql, /slot_unavailable/);
  assert.match(sql, /Africa\/Lagos/);
});
