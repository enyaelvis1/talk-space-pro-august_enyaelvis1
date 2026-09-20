# Remaining work checklist — 2026-08-10

Snapshot of what is still outstanding after the security-hardening pass
completed on 10 August 2026. Items are grouped by who has to act.

## Done in this pass (for reference)

- [x] Security headers (CSP, HSTS, nosniff, frame/ancestor deny, Referrer, Permissions, COOP) on every response.
- [x] Shared cron authentication for all four scheduled endpoints under `/api/public/hooks/*` (constant-time secret compare, fails closed when the secret is missing).
- [x] Database-backed rate limiting on contact submissions, booking holds and manage-link lookups, keyed by hashed IP.
- [x] Security event log (`security_events`) plus a "Security events" panel on `/admin/audit`.

## 1. Code work still to build

### Security / privacy (§20 — 4 of 8 done)

- [x] Private storage review: confirm every bucket that holds receipts, intake files and media has least-privilege policies and signed-URL-only reads.
      _Notes: Reviewed in `docs/STORAGE_SECURITY_REVIEW_2026-08-10.md`; migration `20260810143000_harden_payment_receipt_storage.sql` keeps `payment-receipts` private, removes direct browser writes, and preserves admin/staff signed-URL review._
- [x] Token expiry/revocation: expire or rotate booking manage tokens after use/appointment completion; add an admin revoke action.
      _Notes: Migration `20260810145500_manage_token_expiry_revocation.sql` adds manage-token expiry/revocation metadata, blocks expired/revoked tokens in booking/payment RPC paths, revokes links on cancel/completion/no-show/expired holds, and adds an admin "Revoke link" action in booking operations._
- [x] Secret handling review: confirm no secret is ever returned to the browser and that admin-entered credentials stay encrypted at rest.
      _Notes: Reviewed in `docs/SECRET_HANDLING_REVIEW_2026-08-10.md`; migration `20260810154000_harden_secret_table_grants.sql` removes direct browser grants from encrypted credential/retry tables, and admin DTOs no longer expose retry/token ciphertext._
- [x] Written threat/security review sign-off covering auth, payments, bookings and the admin surface.
      _Notes: Completed in `docs/THREAT_SECURITY_REVIEW_2026-08-10.md`; sign-off covers auth, payments, bookings, admin operations, scheduled jobs, storage, and residual launch risks._

### Testing / QA (§21 — 1 of 8 done)

- [x] Unit tests for availability generation and appointment state transitions.
      _Notes: Added `test/availability-and-appointment-state.test.ts` to guard available-slot generation, hold creation/expiry, reschedule/cancel rules, terminal status transitions, and manage-token lifecycle revocation._
- [x] Permission and token tests (admin gating, manage-token access, expired holds).
      _Notes: Added `test/permission-and-token-contracts.test.ts` to guard admin-only booking/payment operations, manage-token lookup throttling and active-token checks, owner-or-token payment access, and expired-hold cleanup/revocation._
- [ ] Paystack edge cases: duplicate webhooks, amount/currency mismatch, abandoned then completed payments.
- [ ] Bank-transfer review flow tests (submit, approve, reject).
- [ ] Form template versioning tests.
- [ ] Playwright coverage for the critical journeys: book + pay, reschedule, cancel, contact, admin publish.
- [ ] Cross-browser and mobile verification (iOS Safari, Android Chrome, desktop Safari/Firefox).
- [ ] Staging QA sign-off pass.

### Deployment (§22 — 1 of 8 done)

- [ ] Separate staging and production environments.
- [ ] Vercel environment variables/secrets set for each environment (including `CRON_SECRET`, which now gates all scheduled jobs).
- [ ] Storage bucket policies applied in the production project.
- [ ] Background job schedules and retry/alerting behaviour verified in production.
- [ ] Error tracking and uptime monitoring wired up.
- [ ] Documented rollback and emergency-access procedure.
- [ ] Confirm the scheduled database backup cadence.

### Smaller open items

- [ ] Mobile layout verification pass on the public pages (`REMAINING_IMPLEMENTATION_CHECKLIST.md`).
- [ ] Public design refresh follow-ups still listed in `WEBSITE_CLIENT_POLISH_CHECKLIST.md`.
- [ ] Google Reviews live sync (blocked: needs Google credentials).
- [ ] Residual notes in §03, §04, §06, §07, §12 and §19 of the implementation checklist.

## 2. Needs the content owner / business

- [ ] §01 Approve terminology, staff roles, service list and success measures.
- [ ] §15 Confirm the Zoho recipient addresses for each notification type.
- [ ] §18 Approve migrated content, media optimisation and the redirect map.
- [ ] §23 Launch/handover: production content, domain + SSL, live Paystack/Resend/Google credentials, train two admins, acceptance sign-off.

## 3. Blocked pending credentials

- [ ] Paystack live keys (added from the admin payments screen).
- [ ] Google Calendar / Google Reviews OAuth credentials.
- [ ] Resend / Zoho production email credentials.

## Notes for whoever picks this up

- `CRON_SECRET` must be present in every environment; scheduled jobs return
  `503 cron_secret_not_configured` without it, and `401` for a wrong value.
- Rate-limit counters live in `security_rate_limits`; `purge_expired_rate_limits()`
  clears rows older than a day and can be attached to an existing scheduled job.
