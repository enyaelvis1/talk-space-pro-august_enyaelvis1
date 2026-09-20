# Secret Handling Review — 2026-08-10

Scope: admin-entered credentials and server secrets used by email, payments,
Google Calendar/Meet, scheduled hooks, and retry processing.

## Findings

- Resend API keys are accepted only by admin server functions and stored in
  `email_settings.api_key_ciphertext` with AES-GCM encryption. Browser DTOs
  expose only `hasApiKey` and `apiKeyLast4`.
- Paystack secret and webhook secret are accepted only by admin server functions
  and stored in encrypted `payment_settings` columns. Browser DTOs expose only
  readiness flags, source, and last four characters for the payment secret.
- Google OAuth client secrets, therapist access tokens, and refresh tokens are
  stored in encrypted `google_oauth_settings` and
  `therapist_google_connections` columns. Admin screens expose connection state,
  email, expiry, and sync health, not token material.
- Email retry payloads are encrypted before being written to
  `email_delivery_logs.retry_payload_ciphertext`. The admin delivery-log API now
  derives `canRetry` without returning that ciphertext to the browser.
- `CRON_SECRET`, Supabase service keys, encryption keys, Paystack environment
  secrets, and Google state-signing keys are read from server environment
  variables only.

## Changes Made

- Migration `20260810154000_harden_secret_table_grants.sql` revokes direct
  `anon`/`authenticated` grants on secret-bearing tables and keeps access
  service-role mediated.
- Admin failure queues now read email delivery logs through the server-only
  Supabase admin client.
- Google admin summaries no longer select token ciphertext just to calculate
  connection status.
- Email delivery logs no longer return encrypted retry payload ciphertext to the
  browser.

## Residual Risk

- Admin-entered credentials depend on `EMAIL_SETTINGS_ENC_KEY`; rotating that key
  requires re-entering stored credentials or a managed re-encryption procedure.
- Last-four display values are intentionally stored for operator verification
  and should not be treated as secret material.
- Public publishable keys, including Supabase publishable keys and Paystack
  public keys, are intentionally browser-visible.
