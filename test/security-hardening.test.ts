import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { extractCronSecret, verifyCronRequest } from "../src/lib/cron-auth.ts";
import { formatRateLimitMessage } from "../src/lib/rate-limit.server.ts";

const HOOKS = [
  "src/routes/api/public/hooks/send-reminders.ts",
  "src/routes/api/public/hooks/publish-scheduled.ts",
  "src/routes/api/public/hooks/recheck-payments.ts",
  "src/routes/api/public/hooks/retry-emails.ts",
];

test("every scheduled public hook verifies the cron secret", () => {
  for (const file of HOOKS) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /verifyCronRequest/);
    // No handler may run before the guard returns.
    assert.ok(source.indexOf("verifyCronRequest(request)") > 0);
  }
});

test("cron secret is read from Authorization bearer or x-cron-secret", () => {
  assert.equal(
    extractCronSecret(new Request("https://x.test", { headers: { authorization: "Bearer abc" } })),
    "abc",
  );
  assert.equal(
    extractCronSecret(new Request("https://x.test", { headers: { "x-cron-secret": "def" } })),
    "def",
  );
  assert.equal(extractCronSecret(new Request("https://x.test")), "");
});

test("cron requests are rejected without a matching secret", () => {
  const previous = process.env["CRON_SECRET"];
  process.env["CRON_SECRET"] = "s3cret";
  try {
    assert.equal(verifyCronRequest(new Request("https://x.test"))?.status, 401);
    assert.equal(
      verifyCronRequest(
        new Request("https://x.test", { headers: { authorization: "Bearer wrong" } }),
      )?.status,
      401,
    );
    assert.equal(
      verifyCronRequest(
        new Request("https://x.test", { headers: { authorization: "Bearer s3cret" } }),
      ),
      null,
    );
  } finally {
    if (previous === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = previous;
  }
});

test("missing cron secret configuration fails closed with 503", () => {
  const previous = process.env["CRON_SECRET"];
  delete process.env["CRON_SECRET"];
  try {
    assert.equal(
      verifyCronRequest(new Request("https://x.test", { headers: { authorization: "Bearer x" } }))
        ?.status,
      503,
    );
  } finally {
    if (previous !== undefined) process.env["CRON_SECRET"] = previous;
  }
});

test("public write endpoints are rate limited", () => {
  const booking = readFileSync("src/lib/booking.functions.ts", "utf8");
  assert.match(booking, /bucket: "booking_hold"/);
  assert.match(booking, /bucket: "manage_token_lookup"/);
  assert.match(readFileSync("src/lib/contact.functions.ts", "utf8"), /bucket: "contact_submit"/);
});

test("booking manage links have expiry and admin revocation controls", () => {
  const migration = readFileSync(
    "supabase/migrations/20260810145500_manage_token_expiry_revocation.sql",
    "utf8",
  );
  assert.match(migration, /manage_token_expires_at/);
  assert.match(migration, /manage_token_revoked_at/);
  assert.match(migration, /appointment_manage_token_is_active/);
  assert.match(migration, /revoke_appointment_manage_token/);
  assert.match(migration, /public\.appointment_manage_token_is_active\(p_appointment\)/);

  const payments = readFileSync("src/lib/payments.functions.ts", "utf8");
  assert.match(payments, /hasActiveManageToken/);
  assert.match(payments, /manage_token_expires_at/);
  assert.match(payments, /manage_token_revoked_at/);

  const adminBookings = readFileSync("src/routes/_authenticated.admin.bookings.tsx", "utf8");
  assert.match(adminBookings, /revokeAppointmentManageToken/);
  assert.match(adminBookings, /Revoke link/);
});

test("secret-bearing admin data is server-mediated and ciphertext stays out of browser DTOs", () => {
  const migration = readFileSync(
    "supabase/migrations/20260810154000_harden_secret_table_grants.sql",
    "utf8",
  );
  for (const table of [
    "email_settings",
    "payment_settings",
    "google_oauth_settings",
    "therapist_google_connections",
    "email_delivery_logs",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table} from anon, authenticated`),
    );
    assert.match(migration, new RegExp(`grant all on table public\\.${table} to service_role`));
  }

  const emailFunctions = readFileSync("src/lib/email.functions.ts", "utf8");
  assert.doesNotMatch(
    emailFunctions,
    /select\(\s*["'][^"']*retry_payload_ciphertext[^"']*["']\s*\)/,
  );
  assert.match(emailFunctions, /\.not\("retry_payload_ciphertext", "is", null\)/);

  const googleFunctions = readFileSync("src/lib/google.functions.ts", "utf8");
  assert.doesNotMatch(
    googleFunctions,
    /select\(\s*["'][^"']*access_token_ciphertext[^"']*["']\s*\)/,
  );
  assert.match(googleFunctions, /\.not\("access_token_ciphertext", "is", null\)/);

  const review = readFileSync("docs/SECRET_HANDLING_REVIEW_2026-08-10.md", "utf8");
  assert.match(review, /Browser DTOs expose only/);
  assert.match(review, /service-role mediated/);
});

test("threat review sign-off covers the critical security surfaces", () => {
  const review = readFileSync("docs/THREAT_SECURITY_REVIEW_2026-08-10.md", "utf8");
  for (const heading of [
    "## Auth Review",
    "## Payments Review",
    "## Bookings Review",
    "## Admin Surface Review",
    "## Residual Risks",
    "## Sign-Off",
  ]) {
    assert.match(review, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(review, /CRON_SECRET/);
  assert.match(review, /rate limiting/);
  assert.match(review, /Paystack payments validate provider reference, amount, and currency/);
  assert.match(review, /payment-receipts/);
  assert.match(review, /Manage-token operations check the token hash, expiry, revocation/);
  assert.match(review, /direct `anon` or `authenticated` table\s+access/);
  assert.match(review, /approved for merge to `develop`/);
});

test("rate limit messages tell the visitor when to retry", () => {
  assert.match(formatRateLimitMessage(90, "booking"), /2 minutes/);
  assert.match(formatRateLimitMessage(10, "message"), /1 minute\./);
});
