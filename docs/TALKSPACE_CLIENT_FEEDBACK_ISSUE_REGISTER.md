# Talk Space — Client Feedback Issue Register

Audit date: 24 September 2026
Branch: `audit/talkspace-current-work-client-feedback`
Status vocabulary: Open / Partially Resolved / Ready for Fix / Needs Clarification

This register records findings from static code and migration inspection. It is
not a claim that production data or provider configuration has been verified.

## Issue register

### TS-001 — Replace the in-person Lagos address

- Priority: P1
- Area: Public content, footer, contact, email location copy
- Client feedback: Update the Lagos address to `Talk Space Counselling - Lagos,
  Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos`.
- Current observed behaviour: CMS footer settings can contain offices, but the
  code fallback is `20, Estaport Avenue / Gbagada, Lagos, Nigeria`; seeded
  contact/about/privacy content also contains Gbagada/Estaport text. Email
  physical-location rendering uses `TS.addresses` fallbacks.
- Expected behaviour: One approved canonical address appears consistently on
  contact, footer, booking confirmation, receipts/emails, and admin previews.
- Likely files/modules: `src/lib/talkspace.ts`, `src/lib/content.functions.ts`,
  `src/components/site/SiteFooter.tsx`, `src/lib/email-templates.server.ts`,
  `src/lib/page-seed-content.ts`, relevant content rows/migrations.
- Root-cause hypothesis: CMS row and code/seed fallbacks have different owners
  and are not validated against one canonical location record.
- Recommended fix: Update the approved CMS value, reconcile fallback/seed copy,
  and add a single location resolver used by public pages and emails.
- Migration may be needed: Unknown; likely only if a canonical locations table
  is preferred over the existing settings JSON.
- UAT: Check footer/contact/about, in-person booking, confirmation email preview,
  and admin settings with the CMS row present and absent.
- Evidence: Screenshots, rendered email preview, exact approved address, and
  database/CMS row key.
- Status: Ready for Fix
- Notes: Do not change the address in production during this audit.

### TS-002 — Confirm CMS ownership of address/footer/contact details

- Priority: P1
- Area: CMS/admin governance
- Client feedback: Determine whether address/footer/contact details are editable.
- Current observed behaviour: `/admin/settings` edits `site_details` and
  `footer_settings`; public shell reads those rows. Defaults and seeded content
  remain hardcoded fallbacks.
- Expected behaviour: Admin can see which values are authoritative and update
  all public/contact surfaces without code changes.
- Likely files/modules: `src/routes/_authenticated.admin.settings.tsx`,
  `src/lib/admin.functions.ts`, `src/lib/content.functions.ts`, public content
  editor and seed modules.
- Root-cause hypothesis: CMS capability exists but content ownership and fallback
  precedence are undocumented.
- Recommended fix: Document the source-of-truth matrix, show fallback warnings,
  and remove duplicate address constants after content migration/UAT.
- Migration may be needed: No, unless normalizing offices into a table.
- UAT: Edit each field in admin, reload public routes, clear/miss the row, and
  confirm no stale address resurfaces unexpectedly.
- Evidence: Before/after screenshots and source-of-truth matrix.
- Status: Partially Resolved
- Notes: The editor exists; consistency and governance remain open.

### TS-003 — Make email body content admin-editable

- Priority: P1
- Area: Email/CMS
- Client feedback: Determine whether admins can edit emails sent by Talk Space.
- Current observed behaviour: Admin can toggle templates and override subjects;
  bodies are rendered by `src/lib/email-templates.server.ts`.
- Expected behaviour: Approved admins can edit versioned body content with safe
  placeholders, preview, publish/rollback, and audit history.
- Likely files/modules: `src/lib/email-templates.server.ts`,
  `src/lib/email.functions.ts`, `src/routes/_authenticated.admin.emails.tsx`,
  `email_template_settings` migration/schema.
- Root-cause hypothesis: The template table stores metadata/subject overrides,
  while body rendering remains code-owned.
- Recommended fix: Add sanitized body/subject versions and a placeholder
  allowlist; retain code fallback when no published override exists.
- Migration may be needed: Yes, likely new body/version fields or a template
  revision table.
- UAT: Preview and send a staging test for booking, payment, reminder, review,
  and bank-transfer templates; verify placeholders and rollback.
- Evidence: Template revision ID, preview screenshot, delivery log, and redacted
  email screenshot.
- Status: Ready for Fix

### TS-004 — Verify one-month in-person package price

- Priority: P0
- Area: Pricing/checkout/payment
- Client feedback: One-month in-person package shows ₦210,000 instead of ₦323,000.
- Current observed behaviour: `src/lib/service-pricing.ts` has a ₦323,000 fallback
  for `one_month_individual`; services/admin/booking/purchase code supports
  `in_person_price_ngn`. Static code therefore appears corrected, but live DB,
  public cached content, and existing checkout rows were not inspected.
- Expected behaviour: Every new in-person one-month individual quote, checkout,
  ledger, receipt, and admin display is ₦323,000; online remains ₦210,000.
- Likely files/modules: service seed/migration, `service-pricing.ts`, booking,
  purchase, pricing, payment ledger and receipt modules.
- Root-cause hypothesis: stale service row, old seeded public copy, or a checkout
  path using `price_ngn` instead of `in_person_price_ngn`.
- Recommended fix: Verify/update the live service row through an approved
  migration/admin flow and add an end-to-end mode-price contract.
- Migration may be needed: Unknown; yes if the live row is wrong.
- UAT: Compare online/in-person pricing page, booking, purchase, Paystack amount,
  bank-transfer amount, admin ledger, and receipt.
- Evidence: Service row, checkout totals, payment reference, and screenshots.
- Status: Partially Resolved
- Notes: Do not assume the fallback proves production data is correct.

### TS-005 — Audit all in-person amounts and mode fallbacks

- Priority: P0
- Area: Service catalogue, booking, checkout, admin, receipts
- Client feedback: Ensure every physical/in-person amount is correct everywhere.
- Current observed behaviour: Four service codes have explicit in-person fallback
  prices. Other services can fall back to the online `price_ngn` when no in-person
  value exists, while some are contact/custom quote services.
- Expected behaviour: Each service explicitly declares in-person availability
  and price; no silent online-price fallback for an in-person purchase.
- Likely files/modules: `src/lib/service-pricing.ts`, booking/purchase/payment
  functions, admin service editor, public pricing, receipt/email renderers.
- Root-cause hypothesis: Nullable `in_person_price_ngn` conflates “not offered,”
  “custom quote,” and “use online price.”
- Recommended fix: Model an explicit in-person pricing policy and enforce it in
  public display, booking, payment initialization, and admin editing.
- Migration may be needed: Possible, for a pricing-policy/availability field.
- UAT: Test every service and mode, including custom quote, Paystack, bank
  transfer, package, receipt, refund/review, and admin displays.
- Evidence: Price matrix and matching stored ledger totals.
- Status: Ready for Fix

### TS-006 — Ensure confirmed urgent bookings receive Meet links

- Priority: P0
- Area: Google Calendar/Meet and notifications
- Client feedback: Meeting link is pending for urgent appointments.
- Current observed behaviour: Confirmed appointments trigger an idempotent
  Google sync when settings and therapist connection exist. Failures are stored
  in `google_sync_error`; sync is best-effort and can leave a confirmed booking
  without a Meet URL.
- Expected behaviour: Valid online confirmed sessions either have a Meet link
  before confirmation email delivery or enter a visible retry/review state with
  no misleading “link ready” message.
- Likely files/modules: `src/lib/google.functions.ts`, `src/lib/google.server.ts`,
  booking/payment functions, admin Google and bookings routes, email renderer.
- Root-cause hypothesis: provider connection/configuration failure, asynchronous
  sync ordering, or a confirmation path that does not await/retry Meet creation.
- Recommended fix: Define confirmation ordering, bounded retry/backoff, and a
  clear pending/review status; test urgent same-day sessions separately.
- Migration may be needed: Unknown; existing sync-error fields may suffice.
- UAT: Confirm urgent online booking with connected/disconnected therapist,
  retry sync, reschedule, cancel, and inspect email/admin state.
- Evidence: Appointment ID, Google event/Meet ID, sync timestamps/errors, and
  redacted email.
- Status: Partially Resolved

### TS-007 — Show current/today operations

- Priority: P1
- Area: Admin dashboard/operations
- Client feedback: Operations page shows old operations instead of today/current.
- Current observed behaviour: Admin appointment workspace has explicit WAT day
  bounds for today and a 30-day upcoming window, both limited to confirmed,
  unarchived appointments. Dashboard summary separately counts future confirmed
  appointments from `now` onward.
- Expected behaviour: “Today/current operations” is clearly labelled, WAT-based,
  refreshable, and excludes archived/cancelled/unpaid rows while preserving a
  separate upcoming view.
- Likely files/modules: `src/lib/booking.functions.ts`, admin index/bookings
  routes, dashboard components.
- Root-cause hypothesis: stale loader/cache, ambiguous labels, separate count/list
  query semantics, or test data dates in the wrong timezone.
- Recommended fix: Share a query contract and explicit WAT date key; add a
  current-day refresh and boundary tests.
- Migration may be needed: No, unless indexes are needed for scale.
- UAT: Test before/after midnight WAT, today’s confirmed/cancelled/archived rows,
  and dashboard count versus operations list.
- Evidence: WAT timestamp, query result, screenshot, and refresh result.
- Status: Partially Resolved

### TS-008 — Standardize WAT/Africa-Lagos handling

- Priority: P1
- Area: Time/date display and booking
- Client feedback: Adjust all date/time handling to West African Time.
- Current observed behaviour: Availability and many admin/email formatters use
  `Africa/Lagos`; other pages use `Intl.DateTimeFormat("en-NG")` without an
  explicit timezone, and multiple conversion paths exist.
- Expected behaviour: Stored instants remain UTC/timestamptz; all user-facing
  booking/admin/email dates display consistently in `Africa/Lagos`.
- Likely files/modules: `src/lib/time.ts`, booking slots/functions, admin routes,
  emails, Google event payloads, date inputs.
- Root-cause hypothesis: implicit browser/server timezone formatting and duplicate
  local-to-UTC conversions.
- Recommended fix: Centralize WAT formatters/date-key helpers and add boundary
  tests for server, browser, Google, and email output.
- Migration may be needed: No for display; possible data correction if rows were
  stored with an incorrect timezone.
- UAT: Test Lagos midnight, 10:30 slots, same-day booking, admin, email, and
  Google Calendar display.
- Evidence: ISO instant plus rendered WAT value at each surface.
- Status: Partially Resolved

### TS-009 — Auto-fill registered client details

- Priority: P1
- Area: Booking/auth/client profile
- Client feedback: Registered clients should not retype their details.
- Current observed behaviour: The booking path calls `getBookingPrefill()` and
  links signed-in bookings to the client record; anonymous visitors are offered a
  sign-in path but can continue as guests.
- Expected behaviour: Authenticated client name, email, phone, and relevant
  preferences prefill without overwriting deliberate edits.
- Likely files/modules: `src/routes/book.tsx`, `src/lib/booking.functions.ts`,
  client/profile functions and auth state.
- Root-cause hypothesis: missing/legacy profile fields, delayed auth state, or
  UI state initialization after loader completion.
- Recommended fix: Verify field precedence, loading state, editability, and
  client-to-appointment linkage with real staging accounts.
- Migration may be needed: Unknown; only if profile/client columns are missing.
- UAT: Sign in as a registered client, open booking, verify prefill/edit/save,
  complete booking, and inspect linked client ID.
- Evidence: Redacted account role, booking reference, and before/after screenshots.
- Status: Partially Resolved

### TS-010 — Audit Paystack confirmation flow

- Priority: P0
- Area: Paystack checkout/callback/webhook/admin
- Client feedback: Investigate Paystack behavior and automatic booking confirmation.
- Current observed behaviour: Initialization, callback/admin verification, exact
  amount/currency/reference validation, payment status RPCs, grouped checkout
  loading, client sync, Google sync, and payment emails are implemented.
- Expected behaviour: One valid Paystack transaction commits the intended booking
  group exactly once and produces a confirmed booking/client/payment state.
- Likely files/modules: `src/lib/payments.functions.ts`, `payments.server.ts`,
  `paystack-checkout.server.ts`, callback route, webhook/recheck routes, payment
  migrations.
- Root-cause hypothesis: test/live account mismatch, stale/missing provider
  reference, grouped checkout mapping, callback/webhook ordering, or provider
  delay.
- Recommended fix: Run isolated staging matrix for callback, webhook, admin
  recheck, retries, grouped purchase, mismatch, and duplicate delivery.
- Migration may be needed: Unknown; current ledger/group fields may suffice.
- UAT: Test online single/grouped purchases, callback refresh, webhook retry,
  admin Check Paystack, and mismatched references.
- Evidence: Redacted provider response, stored reference/amount/currency,
  booking/payment IDs, status timeline, and email/Meet results.
- Status: Partially Resolved

### TS-011 — Explain Paystack failure/delay states to admin

- Priority: P0
- Area: Payment review/admin UX
- Client feedback: Paystack confirmation can fail or delay booking confirmation.
- Current observed behaviour: Admin verification maps common provider errors to
  user-facing messages and refuses state mutation on mismatch; unresolved
  payments have delayed recheck support and paid booking review metadata.
- Expected behaviour: Admin can distinguish not-found/account mismatch, provider
  delay, amount mismatch, already confirmed, and booking-review-required states.
- Likely files/modules: payment functions/admin payments UI, payment review schema,
  delayed recheck route and admin dashboard queues.
- Root-cause hypothesis: operational state is correct but the UI collapses distinct
  provider/booking states or uses the wrong reference/account mode.
- Recommended fix: Preserve structured failure codes and show next action,
  provider mode, stored reference, and whether booking commitment succeeded.
- Migration may be needed: Possible if structured review fields are insufficient.
- UAT: Trigger not-found, wrong-mode, delayed, amount mismatch, duplicate, and
  success cases using sandbox data only.
- Evidence: Error code/message, payment timeline, admin screenshot, and no-duplicate
  state assertion.
- Status: Ready for Fix

### TS-012 — Complete Google Reviews download/update audit

- Priority: P1
- Area: CMS/reviews/provider sync
- Client feedback: Check remaining reviews, loading method, automatic updates, and
  manual sync requirements.
- Current observed behaviour: Admin refresh and cron routes exist; CSV helpers and
  stable provider IDs/pagination logic are covered by existing checklist notes.
  Static inspection cannot establish provider result limits or current stored count.
- Expected behaviour: Admin sees the complete available stored set, can download
  it, and understands automatic refresh cadence/provider limits.
- Likely files/modules: `src/lib/admin.functions.ts`, Google review route, CSV
  helper, refresh cron, migrations/schema.
- Root-cause hypothesis: provider API pagination/limits, refresh schedule, or
  stable-ID mapping is not visible to operators.
- Recommended fix: Document provider source/limits/cadence, expose last refresh,
  imported/updated counts, and verify multi-page fixtures.
- Migration may be needed: Possible provider ID/refresh metadata fields.
- UAT: Import multi-page fixture, download CSV, update/add review, refresh again,
  verify no duplicates and public rendering.
- Evidence: Counts, CSV, provider IDs, refresh log, and screenshots.
- Status: Partially Resolved

### TS-013 — Document sitemap/Search Console/indexing ownership

- Priority: P1
- Area: SEO/operations
- Client feedback: Confirm sitemap generation, Search Console submission, and pages
  that should be indexed.
- Current observed behaviour: `/sitemap.xml` includes selected public routes,
  published posts/pages, and `/robots.txt` points to it while disallowing admin
  and account. No repository code submits the sitemap to Google Search Console.
- Expected behaviour: Public indexable route policy and ownership of Search
  Console submission are explicit and maintained.
- Likely files/modules: sitemap/robots routes, SEO helpers, CMS publishing rules,
  deployment/operations documentation.
- Root-cause hypothesis: generation is implemented but external submission and
  index policy are undocumented.
- Recommended fix: Publish an indexability matrix, validate canonical URLs,
  submit/monitor in the organization’s Search Console account, and document the
  owner; do not index private/admin/payment routes.
- Migration may be needed: No.
- UAT: Fetch sitemap/robots, validate URLs/status/canonicals, inspect published
  and draft content, and confirm Search Console ownership separately.
- Evidence: XML/robots response, URL inventory, Search Console property owner,
  and coverage screenshot.
- Status: Ready for Fix

### TS-014 — Verify confirmation, Meet, and reminder notifications

- Priority: P0
- Area: Email delivery/reminders
- Client feedback: Confirm booking confirmations, meeting links, and reminders
  are sent correctly after completed payment.
- Current observed behaviour: Email templates format WAT dates and Meet links;
  delivery logs, retries, claims, reminder windows, and admin failure queues exist.
  Provider deliverability and recipient policy remain external/staging concerns.
- Expected behaviour: A committed payment sends one complete confirmation after
  booking/Meet state is known, then reminders only for confirmed unarchived rows.
- Likely files/modules: email server/templates/functions, payment/booking functions,
  reminder hook, admin emails/audit UI, provider configuration.
- Root-cause hypothesis: provider delivery/configuration, async Meet ordering,
  claim races, disabled templates, or incomplete grouped payload.
- Recommended fix: Execute a staging notification matrix and add explicit
  end-to-end assertions for recipient, template, state, link, and retry.
- Migration may be needed: Unknown; claim columns already exist.
- UAT: Pay, confirm, inspect inbox/log, fail/retry email, create Meet failure,
  and test 24h/1h reminder windows in WAT.
- Evidence: Redacted emails, delivery log IDs/statuses, Meet URL, payment/booking
  references, and retry evidence.
- Status: Partially Resolved

### TS-015 — Prevent incomplete/unpaid notification and slot leakage

- Priority: P0
- Area: Booking lifecycle/operations
- Client feedback: Check whether incomplete/unpaid bookings notify admins or occupy
  therapist slots.
- Current observed behaviour: Holds/pending payment have expiry and recent
  lifecycle migrations; admin upcoming/today queries select confirmed rows only.
  Some booking/admin notice paths intentionally fire at hold creation, so the
  exact notification policy needs confirmation.
- Expected behaviour: Holds may temporarily reserve a slot only for their short
  TTL; unpaid/expired rows never appear as confirmed operations or trigger
  confirmed-booking notifications.
- Likely files/modules: booking functions, hold lifecycle migrations, booking
  email helper, admin operations queries, slot calculation.
- Root-cause hypothesis: distinction between “new hold” internal notice and
  “confirmed booking” notice is unclear, or expiry/retry race leaves stale rows.
- Recommended fix: document notification policy, inspect claim/status transitions,
  and add concurrent expiry/payment/slot regression tests.
- Migration may be needed: Possible index/claim or lifecycle correction.
- UAT: Abandon checkout, let hold expire, retry payment, book concurrently, and
  verify slot/admin/email states.
- Evidence: Appointment statuses/timestamps, slot responses, email logs, and
  admin screenshots.
- Status: Partially Resolved

### TS-016 — Verify bank-transfer manual approval commitment

- Priority: P0
- Area: Bank transfer/payment/admin booking
- Client feedback: Confirm manual approval creates the booking/client records and
  does not leave paid bookings unusable.
- Current observed behaviour: `verify_bank_transfer` and the admin server flow
  update payment status, inspect booking status, sync client records, trigger
  Google sync, and send payment success email. Paid-cancelled recovery and
  booking-review metadata also exist.
- Expected behaviour: Approving a valid transfer atomically commits the intended
  booking/client/payment state, creates/re-enables the Meet/email flow where
  applicable, and is idempotent.
- Likely files/modules: payment functions, bank-transfer migrations/RPCs, client
  sync, Google/email helpers, admin payments/bookings UI.
- Root-cause hypothesis: legacy cancelled/paid rows, grouped references, RPC
  state mismatch, or an error after payment commit before downstream actions.
- Recommended fix: Run bank-transfer approval/recovery matrix and expose a clear
  review/retry path without re-creating duplicate records.
- Migration may be needed: Unknown; current recovery migrations may suffice.
- UAT: Submit transfer, approve once/repeat, reject, approve a paid-cancelled
  row, inspect client/booking/payment/Meet/email/audit state.
- Evidence: Payment review, booking/client IDs, status timeline, email/Meet logs,
  and duplicate-count assertion.
- Status: Partially Resolved

## Priority summary

- P0: 8 issues — TS-004, TS-005, TS-006, TS-010, TS-011, TS-014, TS-015, TS-016
- P1: 8 issues — TS-001, TS-002, TS-003, TS-007, TS-008, TS-009, TS-012, TS-013
- P2: 0 issues

## Clarifications required from the client/operations owner

- Is the new Lagos address the only physical office, or should Abuja remain
  visible as a separate office?
- Which email recipients count as the internal notification audience?
- Should a temporary hold create an internal notice, or only a confirmed booking?
- Should custom-quote services be bookable online/in person, or contact-only?
- Does “all Google Reviews” mean all provider-available reviews or all records
  currently stored in Talk Space?
- Who owns Search Console submission and ongoing indexing review?
- What is the approved retention/access policy for client, payment, and intake
  data in any future export or recovery archive?

## Audit acceptance gate

No item should be marked resolved for production solely from static inspection.
The implementation PR must attach staging evidence for the relevant UAT steps,
redact client/payment secrets, and follow `feature/*` → `develop` → staging/UAT
→ separate approved release PR to `main`.
