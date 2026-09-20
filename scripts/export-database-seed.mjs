#!/usr/bin/env node
/**
 * Export current settings + content data as a re-runnable SQL seed file.
 *
 * Usage:
 *   node scripts/export-database-seed.mjs [outputPath]
 *
 * Defaults to supabase/migrations/<timestamp>_data_seed.sql
 *
 * Only configuration and public content tables are exported. Client, appointment,
 * payment, audit and submission tables are intentionally excluded because they
 * hold personal data. Encrypted credential columns are nulled out so no secret
 * material is written to the repository.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Order matters: parents before children (foreign keys).
const TABLES = [
  "site_settings",
  "services",
  "therapists",
  "therapist_services",
  "availability_rules",
  "availability_exceptions",
  "faqs",
  "testimonials",
  "content_media",
  "content_entries",
  "content_entry_media",
  "redirects",
  "email_settings",
  "email_template_settings",
  "payment_settings",
  "reminder_settings",
  "google_oauth_settings",
];

/** Columns removed from the export (secret material). */
const REDACTED = {
  email_settings: ["api_key_ciphertext", "api_key_last4"],
  payment_settings: [
    "paystack_secret_ciphertext",
    "paystack_secret_last4",
    "paystack_webhook_secret_ciphertext",
  ],
  google_oauth_settings: ["client_secret_ciphertext"],
};

function psql(sql) {
  return execFileSync("psql", ["-At", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
}

function rowStatements(table) {
  const redacted = REDACTED[table] ?? [];
  const json = redacted.length
    ? `(to_jsonb(t) - ${redacted.map((c) => `'${c}'`).join(" - ")})`
    : "to_jsonb(t)";
  const sql = `SELECT format(
      'INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(null::public.${table}, %L::jsonb) ON CONFLICT DO NOTHING;',
      ${json}
    ) FROM public.${table} t`;
  return psql(sql)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const outPath = process.argv[2] ?? `supabase/migrations/${stamp}_data_seed.sql`;

const parts = [
  "-- Talk Space settings and content seed",
  `-- Generated ${new Date().toISOString()} by scripts/export-database-seed.mjs`,
  "-- Re-runnable: every statement is ON CONFLICT DO NOTHING.",
  "-- Encrypted credentials are excluded and must be re-entered from the admin.",
  "",
];

let total = 0;
for (const table of TABLES) {
  const statements = rowStatements(table);
  total += statements.length;
  parts.push(`-- ${table} (${statements.length} rows)`);
  parts.push(...statements, "");
  process.stderr.write(`${table}: ${statements.length}\n`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${parts.join("\n")}\n`, "utf8");
process.stderr.write(`\nWrote ${total} rows to ${outPath}\n`);
