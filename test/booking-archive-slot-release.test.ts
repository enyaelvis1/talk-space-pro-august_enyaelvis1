import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260924130000_exclude_archived_bookings_from_slots.sql",
    import.meta.url,
  ),
  "utf8",
);

test("archived appointments no longer block public availability", () => {
  assert.match(migration, /appointment\.archived_at IS NULL/);
  assert.match(migration, /appointment\.status IN \('hold', 'pending_payment', 'confirmed'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.list_available_slots/);
});
