# Threat And Security Review Sign-Off - 2026-08-10

Status: engineering sign-off for the current `develop` pull request. This is
not a substitute for penetration testing, staging QA, or production operational
sign-off.

Scope: authentication, payments, bookings, admin operations, scheduled jobs,
storage, and admin-entered secrets.

## Summary

The reviewed controls are acceptable for merging this security-hardening batch
into `develop`, provided the residual risks below remain tracked before
production launch.

Related review artifacts:

- `docs/STORAGE_SECURITY_REVIEW_2026-08-10.md`
- `docs/SECRET_HANDLING_REVIEW_2026-08-10.md`
- `supabase/migrations/20260810143000_harden_payment_receipt_storage.sql`
- `supabase/migrations/20260810145500_manage_token_expiry_revocation.sql`
- `supabase/migrations/20260810152000_fix_manage_token_revoke_rpc_ambiguity.sql`
- `supabase/migrations/20260810154000_harden_secret_table_grants.sql`

## Auth Review

- Admin mutations require a Supabase session and a positive admin role check
  before data changes are made.
- Staff/client-only access is separated from admin-only surfaces; client
  management DTOs avoid exposing booking manage tokens.
- Public scheduled endpoints require `CRON_SECRET` and fail closed when the
  secret is missing.
- Contact submissions, booking holds, and manage-link lookups are protected by
  database-backed rate limiting keyed by hashed IP.

Sign-off: acceptable for this batch. Continue with the planned permission and
token tests before release.

## Payments Review

- Paystack payments validate provider reference, amount, and currency before
  marking a payment successful.
- Paystack webhook handling requires the `x-paystack-signature` verification
  path, with secrets loaded server side.
- Bank-transfer receipts are stored in the private `payment-receipts` bucket and
  are reviewed through signed URLs.
- Admin payment settings and secrets are server-mediated. Browser DTOs expose
  status, public keys, and last-four values only.

Sign-off: acceptable for this batch. Duplicate webhook, mismatch, and
bank-transfer review tests remain required before production launch.

## Bookings Review

- Appointment holds have a five-minute expiry and active slots exclude hold,
  pending-payment, and confirmed appointments.
- Manage-token operations check the token hash, expiry, revocation timestamp,
  and terminal appointment statuses.
- Manage links are revoked on cancellation, completion, no-show, expired holds,
  and explicit admin revocation.
- Reminder and payment emails no longer embed expired or revoked manage links.

Sign-off: acceptable for this batch. Add state-transition tests and a critical
journey Playwright booking flow before launch.

## Admin Surface Review

- Admin dashboard actions are protected by server-side role checks, not by UI
  visibility alone.
- Secret-bearing tables no longer grant direct `anon` or `authenticated` table
  access; server functions use the service role only after admin authorization.
- Email retry payload ciphertext and Google token ciphertext are not returned in
  admin browser DTOs.
- Security events are available on `/admin/audit` for review of rate-limit and
  guard activity.

Sign-off: acceptable for this batch. A full desktop/mobile admin QA pass is
still required.

## Residual Risks

- Production credentials are not present in this repo and must be configured per
  environment before launch.
- Encryption key rotation is not automated; rotating
  `EMAIL_SETTINGS_ENC_KEY` requires re-entering or re-encrypting stored
  credentials.
- Error tracking, uptime monitoring, scheduled backup cadence, and emergency
  access procedures remain deployment work.
- External Paystack, Resend, and Google behavior still needs live-credential
  verification.

## Sign-Off

Reviewer: Codex engineering review
Date: 2026-08-10
Decision: approved for merge to `develop` as part of PR #15 after automated
checks pass and the database migrations listed above are applied.
