import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decryptBackup, encryptBackup, redactBackupRow } from "../src/lib/site-backup-crypto.ts";

const migration = await readFile(
  new URL("../supabase/migrations/20260922180000_admin_site_backups.sql", import.meta.url),
  "utf8",
);
const functions = await readFile(
  new URL("../src/lib/site-backup.functions.ts", import.meta.url),
  "utf8",
);
const crypto = await readFile(new URL("../src/lib/site-backup-crypto.ts", import.meta.url), "utf8");
const route = await readFile(
  new URL("../src/routes/_authenticated.admin.backups.tsx", import.meta.url),
  "utf8",
);
const sidebar = await readFile(
  new URL("../src/components/progress/AdminSidebar.tsx", import.meta.url),
  "utf8",
);
const checklist = await readFile(
  new URL("../docs/ADMIN_BACKUP_RESTORE_CHECKLIST_2026-09-22.md", import.meta.url),
  "utf8",
);

test("backup foundation is private and admin-readable only", () => {
  assert.match(migration, /create table if not exists public\.site_backups/);
  assert.match(migration, /alter table public\.site_backups enable row level security/);
  assert.match(migration, /using \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/);
  assert.match(migration, /values \('site-backups', 'site-backups', false\)/);
  assert.match(migration, /revoke all on public\.site_backups from anon, authenticated/);
  assert.match(migration, /restore_site_content_backup/);
  assert.match(migration, /auth\.jwt\(\) ->> 'role'/);
});

test("backup server contract requires admin, encryption, fixed scope, and signed URLs", () => {
  assert.match(functions, /requireRequestRole\("admin"\)/);
  assert.match(crypto, /BACKUP_ENCRYPTION_KEY/);
  assert.match(crypto, /site_settings/);
  assert.match(functions, /redactBackupRow/);
  assert.match(functions, /const BACKUP_TABLES = \[/);
  assert.match(functions, /"clients"/);
  assert.match(functions, /"appointments"/);
  assert.match(functions, /"payments"/);
  assert.match(functions, /"payment_settings"/);
  assert.match(functions, /redactBackupRow/);
  assert.match(functions, /createSignedUrl\(backup\.storage_path, 300\)/);
  assert.match(functions, /confirmation: z\.literal\("RESTORE SITE BACKUP"\)/);
  assert.doesNotMatch(functions, /from\(data\.table|from\(input\.table|exec\(/);
});

test("admin backup UI exposes protected operations and scope warnings", () => {
  assert.match(sidebar, /Backups & restore/);
  assert.match(sidebar, /\/admin\/backups/);
  assert.match(route, /Create an encrypted backup/);
  assert.match(route, /Download/);
  assert.match(route, /Validate/);
  assert.match(route, /Restore content/);
  assert.match(route, /does not restore operational records/);
  assert.match(route, /useSensitiveActionGate/);
});

test("backup checklist records the required promotion and remote-safety gates", () => {
  assert.match(checklist, /Apply the migration to the approved Supabase target/);
  assert.match(checklist, /release PR from `develop` into `main`/);
  assert.match(checklist, /Auth identities, provider credentials/);
});

test("backup encryption round-trip and site-setting secret redaction work", () => {
  const key = "local-test-key-that-is-long-enough-123456";
  const archive = encryptBackup(
    {
      formatVersion: "1",
      tables: {
        site_settings: [
          redactBackupRow("site_settings", { key: "paystack_secret_key", value: "never-export" }),
        ],
      },
    },
    key,
  );
  const restored = decryptBackup(archive, key) as {
    tables: { site_settings: Array<{ value: string | null }> };
  };
  assert.equal(restored.tables.site_settings[0]?.value, null);
  assert.throws(() => decryptBackup(archive, "wrong-key-that-is-also-long-enough-123"));
});
