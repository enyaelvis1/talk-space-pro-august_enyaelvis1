#!/usr/bin/env node

/**
 * Reconcile a redacted Paystack export against an application payment export.
 *
 * This utility is deliberately offline: it reads local CSV/JSON files only,
 * hashes customer/provider identifiers, and never calls Paystack or Supabase.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parse } from "csv-parse/sync";

const REFERENCE_FIELDS = [
  "reference",
  "transaction_reference",
  "paystack_reference",
  "provider_reference",
  "transaction_ref",
];
const EMAIL_FIELDS = ["email", "customer_email", "customer_email_address"];
const IP_FIELDS = ["ip", "ip_address", "customer_ip"];
const TIMESTAMP_FIELDS = ["paid_at", "created_at", "created", "timestamp", "date"];
const STATUS_FIELDS = ["status", "transaction_status", "payment_status"];

export function normalizeReference(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function firstValue(row, fields) {
  for (const field of fields) {
    const value = row?.[field];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function stableHash(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized ? createHash("sha256").update(normalized).digest("hex").slice(0, 16) : null;
}

function parseInput(path) {
  const source = readFileSync(path, "utf8");
  if (path.endsWith(".json")) {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : (parsed.rows ?? parsed.data ?? []);
  }
  return parse(source, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });
}

function classifyProviderRows(providerRows, applicationRows) {
  const applicationByReference = new Map();
  for (const row of applicationRows) {
    const reference = normalizeReference(firstValue(row, REFERENCE_FIELDS));
    if (reference) applicationByReference.set(reference, row);
  }

  const classifications = { application_linked: 0, provider_only: 0, missing_reference: 0 };
  const amountCounts = new Map();
  const emailCounts = new Map();
  const ipCounts = new Map();
  const rows = [];

  for (const row of providerRows) {
    const reference = normalizeReference(firstValue(row, REFERENCE_FIELDS));
    const application = reference ? applicationByReference.get(reference) : undefined;
    const classification = !reference
      ? "missing_reference"
      : application
        ? "application_linked"
        : "provider_only";
    classifications[classification] += 1;

    const amount = firstValue(row, ["amount", "requested_amount", "amount_ngn", "amount_kobo"]);
    if (amount) amountCounts.set(amount, (amountCounts.get(amount) ?? 0) + 1);
    const emailHash = stableHash(firstValue(row, EMAIL_FIELDS));
    const ipHash = stableHash(firstValue(row, IP_FIELDS));
    if (emailHash) emailCounts.set(emailHash, (emailCounts.get(emailHash) ?? 0) + 1);
    if (ipHash) ipCounts.set(ipHash, (ipCounts.get(ipHash) ?? 0) + 1);

    rows.push({
      reference_hash: stableHash(reference),
      classification,
      amount: amount || null,
      status: firstValue(row, STATUS_FIELDS).toLowerCase() || null,
      timestamp: firstValue(row, TIMESTAMP_FIELDS) || null,
      email_hash: emailHash,
      ip_hash: ipHash,
      application_reference_hash: application
        ? stableHash(firstValue(application, REFERENCE_FIELDS))
        : null,
    });
  }

  const repeated = (counts) =>
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([hashOrAmount, count]) => ({ value: hashOrAmount, count }));

  return {
    input: {
      provider_rows: providerRows.length,
      application_rows: applicationRows.length,
    },
    classifications,
    repeated_amounts: repeated(amountCounts),
    repeated_email_hashes: repeated(emailCounts),
    repeated_ip_hashes: repeated(ipCounts),
    signals: detectSignals(rows),
    rows,
  };
}

export function detectSignals(rows, thresholds = {}) {
  const lowValueNgn = thresholds.lowValueNgn ?? 500;
  const lowValueWindow = thresholds.lowValueWindowMs ?? 15 * 60 * 1000;
  const unmatchedBurst = thresholds.unmatchedBurst ?? 3;
  const grouped = new Map();
  const parseAmount = (value) =>
    Number(
      String(value ?? "")
        .replaceAll(",", "")
        .replace(/^NGN\s*/i, ""),
    );
  const parseTime = (value) => {
    const time = Date.parse(String(value ?? ""));
    return Number.isFinite(time) ? time : null;
  };
  const success = (row) =>
    /^(success|successful|succeeded|paid|completed)$/i.test(String(row.status ?? ""));
  const add = (name, key, row) => {
    const time = parseTime(row.timestamp);
    if (time == null) return;
    const bucket = grouped.get(`${name}:${key}`) ?? [];
    bucket.push({ time, row });
    grouped.set(`${name}:${key}`, bucket);
  };

  for (const row of rows) {
    if (row.timestamp == null) continue;
    if (success(row) && parseAmount(row.amount) > 0 && parseAmount(row.amount) <= lowValueNgn) {
      add("low_value_success", "all", row);
    }
    if (row.classification === "provider_only") add("provider_only", "all", row);
    if (row.email_hash) add("email", row.email_hash, row);
    if (row.ip_hash) add("ip", row.ip_hash, row);
  }

  const burst = (name, key, minimum, windowMs) => {
    const events = (grouped.get(`${name}:${key}`) ?? []).sort((a, b) => a.time - b.time);
    let best = 0;
    for (let start = 0; start < events.length; start += 1) {
      let end = start;
      while (end < events.length && events[end].time - events[start].time <= windowMs) end += 1;
      best = Math.max(best, end - start);
    }
    return best >= minimum
      ? { key, count: best, window_minutes: Math.round(windowMs / 60000) }
      : null;
  };

  const signals = [];
  const lowValue = burst(
    "low_value_success",
    "all",
    thresholds.lowValueCount ?? 10,
    lowValueWindow,
  );
  if (lowValue) signals.push({ type: "low_value_success_burst", ...lowValue });
  const providerOnly = burst("provider_only", "all", unmatchedBurst, lowValueWindow);
  if (providerOnly) signals.push({ type: "provider_only_burst", ...providerOnly });
  for (const [group, entries] of grouped) {
    const [name, key] = group.split(":");
    if (name === "email" || name === "ip") {
      const event = burst(
        name,
        key,
        name === "email" ? (thresholds.emailCount ?? 3) : (thresholds.identityCount ?? 5),
        name === "email" ? 60 * 60 * 1000 : lowValueWindow,
      );
      if (event) signals.push({ type: `${name}_activity_burst`, ...event });
    }
  }
  return signals;
}

export function reconcilePaystackEvidence({ providerRows, applicationRows }) {
  return classifyProviderRows(providerRows, applicationRows);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args["provider-csv"] || !args["application-csv"]) {
    console.error(
      "Usage: node scripts/reconcile-paystack-evidence.mjs --provider-csv EXPORT.csv --application-csv PAYMENTS.csv [--output REPORT.json]",
    );
    process.exitCode = 2;
    return;
  }
  const providerPath = resolve(args["provider-csv"]);
  const applicationPath = resolve(args["application-csv"]);
  if (!existsSync(providerPath) || !existsSync(applicationPath)) {
    throw new Error(
      `Input file not found: ${!existsSync(providerPath) ? basename(providerPath) : basename(applicationPath)}`,
    );
  }

  const report = reconcilePaystackEvidence({
    providerRows: parseInput(providerPath),
    applicationRows: parseInput(applicationPath),
  });
  const output = JSON.stringify(report, null, 2) + "\n";
  if (args.output) writeFileSync(resolve(args.output), output, { mode: 0o600 });
  else process.stdout.write(output);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
