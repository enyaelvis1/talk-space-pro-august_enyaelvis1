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
cross-system verification gaps:

- A successful payment can be committed while booking review or Google sync
  still needs operational attention.
- The application has both CMS-managed values and code fallbacks for address,
  location, and contact data, so stale fallback content can reappear when a CMS
  row is missing or malformed.
- Email bodies are rendered in server code. Admins can toggle templates and
  override subjects, but cannot edit the body copy.
- The admin dashboard has a WAT-aware today window, but the dashboard summary
  also uses a generic future count and the operations surface needs staging
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

- The current Lagos fallback is still `20, Estaport Avenue, Gbagada, Lagos,
  Nigeria`, while the requested address is different.
- Email subject overrides are editable, but email bodies remain hardcoded in
  `src/lib/email-templates.server.ts`.
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

1. P0 payment-to-booking commitment and review-state verification, including
   Paystack grouped payments and bank-transfer approval.
2. P0 confirmed-booking notification and Google Meet ordering/retry behavior.
3. P0 incomplete/unpaid booking slot and admin-notification isolation.
4. P1 canonicalize address, location, pricing, and WAT data ownership between
   CMS, database, emails, and code fallbacks.
5. P1 finish editable email body templates with preview, versioning, and safe
   placeholder validation.
6. P1 verify today/operations views and all WAT boundary cases.
7. P1 complete Google Reviews refresh/export and document Search Console
   responsibility.
8. Run isolated staging/UAT journeys and attach evidence before any release PR.

The disposable-account UAT plan is defined in
`docs/TALKSPACE_DISPOSABLE_UAT_ACCOUNTS.md`. It requires synthetic staging
accounts only; no accounts were created during this audit.

For execution tracking, use
`docs/TALKSPACE_CLIENT_FEEDBACK_TRACKING_CHECKLIST.md`, which consolidates
all 16 feedback issues and the five disposable-account requirements.

## Database-change summary

Potential database work is documented in the issue register only. No migration
was executed during this audit.

- Likely: payment/booking commitment or review-state adjustments, email body
  template fields/versioning, canonical site/location settings, and possibly
  notification claim or operational query indexes.
- Possible: Google Reviews provider ID/pagination fields and explicit booking
  group reconciliation fields.
- Not inherently required: WAT display fixes, sitemap/robots responsibility
  documentation, or UI-only operations filtering.
