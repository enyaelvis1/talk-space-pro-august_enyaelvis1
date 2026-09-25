# Talk Space — Current Work Audit

Audit date: 24 September 2026
Audit branch: `audit/talkspace-current-work-client-feedback`
Baseline: `origin/develop` at `5b0b3f9`
Scope: repository/code/documentation review only. No migrations, deployment,
production data changes, real email, Paystack requests, or live notifications
were run.

## Executive summary

The repository has a substantial working implementation. The strongest areas
are the booking state machine, Africa/Lagos availability calculations, client
prefill, service-level mode pricing, payment ledger validation, admin audit
surfaces, email delivery logging, and idempotent Google synchronization.

The highest-risk remaining areas are not all missing features; several are
cross-system verification gaps after the local implementation batch:

- A successful payment can be committed while booking review or Google sync
  still needs operational attention.
- The application still has CMS-managed values and code fallbacks for address,
  location, and contact data. The canonical fallback/seed values and the
  source-of-truth matrix are now aligned, while already-edited CMS rows need
  content-owner verification.
- Email bodies now support sanitized admin-managed text overrides with a safe
  server-rendered fallback; template rendering and recipient policy still need
  staging email-sink verification.
- The admin dashboard and calendar now use Africa/Lagos date keys for current
  and drag-to-date operations; the operations surface still needs staging
  verification against current dates and archived/unpaid rows.
- Paystack, Google, email-provider, Google Reviews, and Search Console behavior
  cannot be fully proven from static code inspection.

## Audit evidence reviewed

- `README.md`, `AGENTS.md`, `docs/IMPLEMENTATION_CHECKLIST.md`,
  `docs/PRODUCT_SCOPE_AND_BOOKING_RULES.md`, and the existing client/payment/
  notification/reviews checklist.
- Public content, footer, service pricing, booking, payment, Google, email,
  admin dashboard, sitemap, and robots modules under `src/`.
- Supabase schema/migration history under `supabase/migrations/`.
- Recent `develop` history and current branch/worktree state.
- `docs/TALKSPACE_DISPOSABLE_UAT_ACCOUNTS.md`, including current account
  provisioning paths and staging-only cleanup requirements.

## Current implementation assessment

### Appears already implemented or substantially resolved

- Footer and site details have admin-backed `site_settings` records and settings
  editors. The CMS model is present, although code fallbacks remain.
- `one_month_individual` has a code fallback of ₦323,000 for in-person mode;
  service rows also support `in_person_price_ngn` and the admin service editor
  exposes it.
- Booking and payment code resolves mode-specific service pricing and validates
  Paystack amount, currency, and reference before status changes.
- Registered clients have a booking prefill path through `getBookingPrefill()`.
- Availability rules default to `Africa/Lagos`, and admin/today/date/email
  formatting has multiple explicit WAT formatters.
- Holds, pending payment, and committed statuses are separated, with recent
  migrations intended to prevent incomplete bookings reserving slots.
- Google appointment synchronization is intended to be idempotent and stores
  `google_sync_error` for admin recovery.
- Email delivery is logged, retryable, and guarded by delivery claims in the
  payment flow.
- Sitemap and robots routes exist and exclude `/admin` and `/account` from
  crawling.

### Partially resolved or requiring evidence

- The local Lagos fallback and seed content now use the approved
  `Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos`
  wording; the additive CMS reconciliation migration is staging-only.
- Email subject and sanitized body overrides are editable through the admin
  email workspace, with a code fallback when no override is published.
- Google Meet creation is best-effort and requires enabled Google settings and a
  connected therapist account. A confirmed booking can therefore remain in a
  sync-error state.
- Paystack admin verification has clearer error handling, but the real test/live
  account, reference, grouped checkout, callback, webhook, and recheck sequence
  require staging evidence.
- The operations dashboard has WAT-aware today/upcoming queries, but the
  summary count and visible operations list are separate data paths.
- Google Reviews refresh has a cron route and admin refresh path, but provider
  pagination, total available reviews, and Search Console ownership need proof.

## Hardcoded/configuration findings

The following code-owned fallbacks can become stale even though CMS/admin rows
exist:

- `src/lib/talkspace.ts`: phone, WhatsApp, email, offices, and public review
  excerpts.
- `src/lib/content.functions.ts`: default site and footer settings.
- `src/lib/email-templates.server.ts`: physical location selection and email
  body copy.
- `src/lib/page-seed-content.ts` and historical migrations: seeded contact,
  about, privacy, and office copy.
- `src/lib/service-pricing.ts`: fallback in-person prices when the database
  column is unavailable or a service row is incomplete.

These are not automatically defects; they are recovery paths. They should be
made intentionally consistent with the CMS and tested with missing, stale, and
partially populated rows.

## Recommended implementation order

1. Run P0 payment-to-booking, grouped payment, bank-transfer, and slot
   commitment UAT with approved staging migrations and sandbox providers.
2. Verify confirmed-booking notification and Google Meet ordering/retry
   behavior in an email/calendar sink.
3. Verify incomplete/unpaid booking slot and admin-notification isolation.
4. Validate canonical address, location, pricing, email, and WAT values against
   the staging CMS and approved content matrix.
5. Run Google Reviews refresh/export and Search Console ownership checks.
6. Run isolated staging/UAT journeys and attach evidence before any release PR.

The disposable-account UAT plan is defined in
`docs/TALKSPACE_DISPOSABLE_UAT_ACCOUNTS.md`. It requires synthetic staging
accounts only; no accounts were created during this audit.

For execution tracking, use
`docs/TALKSPACE_CLIENT_FEEDBACK_TRACKING_CHECKLIST.md`, which consolidates
all 16 feedback issues and the five disposable-account requirements.

## Database-change summary

Potential database work is documented in the issue register and the two local
additive migrations. No migration was executed against a remote project during
this audit.

- Local/staging candidates: confirmed-contact/payment guards and canonical CMS
  reconciliation, both recorded as additive migrations that require review and
  staging application.
- Possible future: Google Reviews provider fields or explicit booking-group
  reconciliation fields if staging/provider evidence demonstrates they are
  needed.
- Not inherently required: WAT display fixes, sitemap/robots responsibility
  documentation, or UI-only operations filtering.
