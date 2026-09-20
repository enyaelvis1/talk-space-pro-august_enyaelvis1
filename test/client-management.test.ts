import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functions = await readFile(
  new URL("../src/lib/clients.functions.ts", import.meta.url),
  "utf8",
);
const component = await readFile(
  new URL("../src/components/admin/AdminClientDetail.tsx", import.meta.url),
  "utf8",
);
const listComponent = await readFile(
  new URL("../src/components/admin/AdminClients.tsx", import.meta.url),
  "utf8",
);
const legacyClientMigration = await readFile(
  new URL(
    "../supabase/migrations/20260906073000_admin_legacy_client_profiles.sql",
    import.meta.url,
  ),
  "utf8",
);

test("client management protects history, updates, and export", () => {
  assert.match(functions, /appointments/);
  assert.match(functions, /payments/);
  assert.match(functions, /updateAdminClient/);
  assert.match(functions, /createAdminLegacyClient/);
  assert.match(functions, /getClientContactCompletionState/);
  assert.match(functions, /auth\.admin\.createUser/);
  assert.match(functions, /legacyClientSelect/);
  assert.match(functions, /isMissingExtendedClientColumnError/);
  assert.match(functions, /exportAdminClientData/);
  assert.match(functions, /getAdminClientDetail/);
  assert.match(component, /Appointment history/);
  assert.match(component, /Payment summary/);
  assert.match(component, /Wedding anniversary date/);
  assert.match(component, /Occupation/);
  assert.match(listComponent, /Add old client/);
  assert.match(listComponent, /Template/);
  assert.match(listComponent, /talk-space-client-import-template\.csv/);
  assert.match(listComponent, /data: \{ csv, confirm, duplicates \}/);
  assert.match(listComponent, /setImportResult\(res\)/);
  assert.match(listComponent, /Wedding anniversary date/);
  assert.match(listComponent, /await router\.invalidate\(\)/);
  assert.doesNotMatch(listComponent, /window\.location\.reload\(\)/);
  assert.match(listComponent, /<Link\s+to=\{clientDetailsHref\(client\.id\)\}/);
  assert.match(legacyClientMigration, /add column if not exists email text/);
  assert.match(legacyClientMigration, /clients_email_lower_key/);
  assert.match(component, /Export/);
  assert.doesNotMatch(functions, /manage_token/);
});

test("client imports roll back prior writes when a confirmed batch fails", () => {
  assert.match(functions, /const existingSnapshots = new Map/);
  assert.match(functions, /const createdUserIds: string\[\] = \[\]/);
  assert.match(functions, /const createdClientIds: string\[\] = \[\]/);
  assert.match(functions, /await rollback\(\)/);
  assert.match(functions, /Import was rolled back/);
});
