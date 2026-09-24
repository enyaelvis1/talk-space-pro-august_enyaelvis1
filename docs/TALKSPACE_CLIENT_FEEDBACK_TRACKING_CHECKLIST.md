# Talk Space — Client Feedback Tracking Checklist

Audit/UAT date: 24 September 2026
Scope: documentation and staging/UAT planning only
Source: `docs/TALKSPACE_CLIENT_FEEDBACK_ISSUE_REGISTER.md`

## Summary

| Measure | Count / items |
| --- | --- |
| Total items | 21: TS-001 through TS-016 plus UAT-ACC-001 through UAT-ACC-005 |
| P0 count | 8 client-feedback items |
| P1 count | 8 client-feedback items |
| P2 count | 0 |
| Items ready for implementation | 5: TS-001, TS-003, TS-005, TS-011, TS-013 |
| Items needing client clarification | 7: address/office scope, internal recipients, hold notices, custom-quote policy, review scope, Search Console ownership, data-retention policy |
| Items requiring external provider testing | 8: TS-003, TS-006, TS-010, TS-011, TS-012, TS-013, TS-014, TS-015 |
| Items requiring disposable staging accounts | 5: UAT-ACC-001 through UAT-ACC-005 |

Statuses are intentionally not marked UAT Passed, Production Ready, or Done.
No fixes, migrations, deployments, real messages, live Paystack requests,
Google Calendar events, or production changes are included in this checklist.

## Client feedback checklist

### TS-001 — Replace the in-person Lagos address

- [ ] ID: TS-001
- Priority: P1
- Area: Public content, footer, contact, email location copy
- Client feedback summary: Replace the old Lagos/Gbagada address with the approved Ikeja address.
- Required fix or validation: Establish one canonical address resolver, update the approved CMS value and stale fallbacks, and verify public pages, booking copy, emails, and admin previews.
- Owner / role responsible: Product/content owner; frontend and email engineer
- Environment: local / staging / production
- Current status: Open
- UAT steps: Edit the staging site details, reload footer/contact/about and in-person booking, preview confirmation emails, then test missing/malformed CMS-row fallback.
- Evidence required: Approved address, redacted CMS row key, before/after screenshots, email preview.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Clarify whether Abuja remains a separate office before production content is changed.

### TS-002 — Confirm CMS ownership of address/footer/contact details

- [ ] ID: TS-002
- Priority: P1
- Area: CMS/admin governance
- Client feedback summary: Confirm whether admins can edit address, footer, and contact details.
- Required fix or validation: Publish a source-of-truth matrix, show fallback warnings, and verify CMS precedence over code/seed defaults.
- Owner / role responsible: Product/content owner; CMS engineer
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Edit each setting in `/admin/settings`, reload public routes, inspect email preview, and test absent/stale rows.
- Evidence required: Source-of-truth matrix, screenshots, redacted setting keys, fallback test result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Depends on the approved address and office ownership decision.

### TS-003 — Make email body content admin-editable

- [ ] ID: TS-003
- Priority: P1
- Area: Email/CMS
- Client feedback summary: Allow admins to edit the body of Talk Space emails, not only subjects and enabled state.
- Required fix or validation: Add safe, versioned body editing with placeholder allowlists, preview, publish, rollback, audit history, and code fallback.
- Owner / role responsible: Email/CMS engineer; admin product owner
- Environment: local / staging / production
- Current status: Open
- UAT steps: Preview staged booking, payment, reminder, review, and bank-transfer templates; publish a harmless change; verify placeholders, rollback, rendering, and delivery sink logs.
- Evidence required: Revision ID, preview screenshot, placeholder validation, redacted delivery-log result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Requires external email-sink testing and a decision on approved template editors.

### TS-004 — Verify one-month in-person package price

- [ ] ID: TS-004
- Priority: P0
- Area: Pricing/checkout/payment
- Client feedback summary: One-month in-person individual package must be ₦323,000, not ₦210,000.
- Required fix or validation: Verify the live staging service row and every mode-aware pricing path; ensure online remains ₦210,000 and stored ledger totals match.
- Owner / role responsible: Payments/product owner; pricing engineer
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Compare online/in-person pricing page, booking, purchase, sandbox Paystack amount, bank-transfer amount, admin ledger, and receipt.
- Evidence required: Staging service row, price matrix, checkout totals, synthetic payment reference, screenshots.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: No production data or migration may be changed in this audit PR.

### TS-005 — Audit all in-person amounts and mode fallbacks

- [ ] ID: TS-005
- Priority: P0
- Area: Service catalogue, booking, checkout, admin, receipts
- Client feedback summary: Every physical/in-person service price must be correct and must not silently use an online price.
- Required fix or validation: Define explicit in-person availability/pricing policy for every service and reject unsupported/custom-quote modes safely.
- Owner / role responsible: Product/pricing owner; booking and payments engineer
- Environment: local / staging / production
- Current status: Open
- UAT steps: Test every service and mode, including packages, custom quote, Paystack sandbox, bank transfer, receipt, refund/review, and admin displays.
- Evidence required: Complete price matrix and matching stored ledger totals.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Clarify whether custom-quote services are bookable online/in person or contact-only.

### TS-006 — Ensure confirmed urgent bookings receive Meet links

- [ ] ID: TS-006
- Priority: P0
- Area: Google Calendar/Meet and notifications
- Client feedback summary: Confirmed urgent online appointments should not remain without a working Meet link.
- Required fix or validation: Define confirmation ordering, bounded retry/backoff, visible sync-review state, and truthful email/admin status.
- Owner / role responsible: Integrations engineer; operations owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Confirm same-day online bookings with connected/disconnected therapist accounts, retry sync, reschedule, cancel, and inspect admin/email state.
- Evidence required: Appointment ID, event/Meet ID, sync timestamps/errors, redacted email evidence.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Requires safe Google test account or provider sandbox; no live Calendar event in this audit.

### TS-007 — Show current/today operations

- [ ] ID: TS-007
- Priority: P1
- Area: Admin dashboard/operations
- Client feedback summary: Admin operations should show current/today’s work rather than old operations.
- Required fix or validation: Share a WAT-based query contract for dashboard and operations list, label windows clearly, and exclude archived/cancelled/unpaid rows as intended.
- Owner / role responsible: Admin operations owner; dashboard engineer
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Test before/after midnight WAT, today’s confirmed/cancelled/archived/unpaid rows, refresh behavior, and summary/list agreement.
- Evidence required: WAT timestamp, query/result snapshot, screenshot, refresh result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Current summary and operations list use separate data paths.

### TS-008 — Standardize WAT/Africa-Lagos handling

- [ ] ID: TS-008
- Priority: P1
- Area: Timezone and date formatting
- Client feedback summary: All displayed booking and operational times should use West African Time consistently.
- Required fix or validation: Audit every display/query boundary for `Africa/Lagos`, prevent double conversion, and verify storage remains UTC-comparable.
- Owner / role responsible: Booking/platform engineer; QA owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Test booking, admin, therapist, email, reminders, availability, and calendar displays across WAT day boundaries and daylight-independent dates.
- Evidence required: Input UTC timestamp, expected WAT value, screenshots, and request/response metadata.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Some pages use locale formatting without an explicit timezone and need targeted review.

### TS-009 — Auto-fill registered client details

- [ ] ID: TS-009
- Priority: P1
- Area: Booking/auth/client profile
- Client feedback summary: Registered clients should not retype their name, email, and phone when booking.
- Required fix or validation: Verify `getBookingPrefill()` loads the signed-in client/profile safely, permits intentional edits, and links the booking to the client.
- Owner / role responsible: Client experience engineer; auth/permissions owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Sign in as UAT client, open booking, verify prefill/edit/save, complete a synthetic booking, and inspect linked client ID and RLS isolation.
- Evidence required: Redacted account role, before/after screenshots, booking reference, linked client result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Requires UAT-ACC-003; do not use real client information.

### TS-010 — Audit Paystack confirmation flow

- [ ] ID: TS-010
- Priority: P0
- Area: Paystack/payment-to-booking commitment
- Client feedback summary: A successful Paystack payment must confirm the correct booking exactly once and avoid “paid but needs review” leakage unless genuinely required.
- Required fix or validation: Test grouped checkout/reference validation, callback/webhook/recheck ordering, idempotency, amount/currency checks, and booking/payment state reconciliation.
- Owner / role responsible: Payments engineer; finance/operations owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Run sandbox success, duplicate verification, wrong/missing reference, delayed recheck, callback replay, and grouped-payment scenarios.
- Evidence required: Sandbox reference, payment status timeline, booking status, ledger amount, idempotency result, redacted provider response.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Never use live Paystack credentials or charges.

### TS-011 — Explain Paystack failure and delay states to admin

- [ ] ID: TS-011
- Priority: P0
- Area: Paystack admin operations
- Client feedback summary: “Transaction reference not found” and delayed/test payment errors need clear, actionable admin handling.
- Required fix or validation: Map provider errors to safe UI guidance, distinguish test/live/account mismatch, preserve retry/review state, and prevent duplicate payment attempts.
- Owner / role responsible: Payments engineer; support/operations owner
- Environment: local / staging / production
- Current status: Open
- UAT steps: Use sandbox missing, delayed, duplicate, and wrong-account references; inspect error message, retry behavior, audit trail, and booking state.
- Evidence required: Redacted provider error, UI screenshot, retry result, payment/booking timeline.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Requires approved Paystack sandbox credentials and test references.

### TS-012 — Complete Google Reviews download/update audit

- [ ] ID: TS-012
- Priority: P1
- Area: Google Reviews/CMS
- Client feedback summary: Confirm whether all available reviews can be refreshed, updated, downloaded, and managed.
- Required fix or validation: Verify provider pagination, stable IDs, refresh behavior, export capacity, and admin review lifecycle.
- Owner / role responsible: CMS/integrations engineer; content owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Refresh a staged review fixture/provider response, test pagination and duplicate handling, update/publish/unpublish, export, and failure recovery.
- Evidence required: Review counts, stable identifiers, redacted export, refresh log, screenshots.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Clarify whether “all reviews” means provider-available reviews or currently stored records.

### TS-013 — Document sitemap/Search Console/indexing ownership

- [ ] ID: TS-013
- Priority: P1
- Area: SEO/operations
- Client feedback summary: Confirm sitemap coverage and define who submits and monitors it in Search Console.
- Required fix or validation: Validate sitemap/robots output for published public routes and document Search Console ownership, submission, and monitoring.
- Owner / role responsible: SEO/content owner; platform engineer
- Environment: local / staging / production
- Current status: Open
- UAT steps: Inspect staging sitemap/robots, verify published/unpublished route behavior, validate canonical URLs, and document production Search Console handoff.
- Evidence required: Sitemap URL/output, robots screenshot, route inventory, ownership record.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Search Console verification is an external production/ownership activity and is not run here.

### TS-014 — Verify confirmation, Meet, and reminder notifications

- [ ] ID: TS-014
- Priority: P0
- Area: Email/Google/notifications
- Client feedback summary: Confirmed bookings should deliver the right confirmation, Meet details, therapist notice, and reminders exactly once.
- Required fix or validation: Verify notification ordering, recipient policy, atomic claims, retry behavior, and no misleading link-ready messaging.
- Owner / role responsible: Notifications engineer; operations owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Run confirmed online/in-person, urgent, rescheduled, cancelled, bank-transfer, and Paystack sandbox scenarios through an email sink and inspect logs.
- Evidence required: Redacted delivery logs, claim keys/statuses, email previews, Meet sync state, duplicate-count result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Clarify internal notification audience; no live messages allowed.

### TS-015 — Prevent incomplete/unpaid notification and slot leakage

- [ ] ID: TS-015
- Priority: P0
- Area: Booking lifecycle, slots, notifications
- Client feedback summary: Incomplete or unpaid bookings must not create misleading confirmations, block slots indefinitely, or appear as confirmed operations.
- Required fix or validation: Validate hold/pending-payment expiry, slot release, admin visibility, notification suppression, and retry/idempotency behavior.
- Owner / role responsible: Booking engineer; operations/notifications owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Create synthetic hold and pending-payment bookings, abandon/expire them, retry callbacks, inspect public slots/admin lists/notifications, then book the released slot.
- Evidence required: State timeline, expiry timestamps, slot response before/after, notification log, duplicate-count result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Requires UAT-ACC-003 and optional UAT-ACC-005 for concurrent attempts.

### TS-016 — Verify bank-transfer manual approval commitment

- [ ] ID: TS-016
- Priority: P0
- Area: Bank transfer/payment/booking
- Client feedback summary: Confirmed bank transfers must create/restore the booking, payment state, confirmation flow, and booking link reliably.
- Required fix or validation: Test manual approval/recovery RPCs, exact booking/payment linkage, idempotent repeat approval, Meet/email ordering, and admin review state.
- Owner / role responsible: Payments engineer; finance/operations owner
- Environment: local / staging / production
- Current status: In Progress
- UAT steps: Submit a synthetic bank transfer, approve once and twice, inspect booking/client/payment/audit/Meet/email state, and verify recovery of a paid booking without a link.
- Evidence required: Synthetic transfer reference, payment/booking timeline, audit row, redacted email/Meet state, duplicate-approval result.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Use synthetic transfer references and staging storage only.

## Disposable staging account requirements

### UAT-ACC-001 — Super/Admin account

- [ ] ID: UAT-ACC-001
- Priority: P0
- Area: Staging UAT access and admin operations
- Client feedback summary: Provide a disposable admin account for full staging validation.
- Required fix or validation: Provision `uat-admin-20260924-a@talkspace.test` with `admin` role through the staging control plane; verify admin gates and remove it afterward.
- Owner / role responsible: Staging administrator; security/operations owner
- Environment: staging
- Current status: Open
- UAT steps: Verify `/admin`, CMS, clients, bookings, payments, bank transfer, reviews, sitemap, email preview, audit, and destructive-action gates.
- Evidence required: Redacted user ID/role, route screenshots, audit IDs, cleanup confirmation.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: No visible admin-panel account-creation flow; do not promote accounts in production.

### UAT-ACC-002 — Therapist account

- [ ] ID: UAT-ACC-002
- Priority: P0
- Area: Staging UAT access and therapist operations
- Client feedback summary: Provide a disposable therapist account for calendar, dashboard, and access testing.
- Required fix or validation: Create/link `uat-therapist-20260924-a@talkspace.test` through the admin therapist invitation flow and verify `therapist` permissions.
- Owner / role responsible: Staging administrator; therapist/integrations owner
- Environment: staging
- Current status: Open
- UAT steps: Test therapist dashboard, WAT slots, own bookings, Google connection using a safe test account, Meet state, and cross-therapist denial.
- Evidence required: Redacted role/profile ID, dashboard screenshots, sync result, denial result, cleanup confirmation.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Use email sink/provider dry-run; no live invitation or calendar event.

### UAT-ACC-003 — Client account

- [ ] ID: UAT-ACC-003
- Priority: P0
- Area: Staging UAT access and client booking/payment operations
- Client feedback summary: Provide a disposable client account for autofill, booking, package, Paystack sandbox, and bank-transfer testing.
- Required fix or validation: Sign up `uat-client-20260924-a@talkspace.test`, verify automatic `client` role/profile link, run flows, and delete/deactivate afterward.
- Owner / role responsible: Staging administrator; client/payment QA owner
- Environment: staging
- Current status: Open
- UAT steps: Test sign-up/sign-in, prefill, booking, incomplete token, package balance, sandbox Paystack, bank-transfer submission, manage link, and RLS isolation.
- Evidence required: Redacted role/session state, screenshots, synthetic references, payment/booking timeline, cleanup confirmation.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Use synthetic personal data only; no live Paystack request.

### UAT-ACC-004 — Optional second therapist

- [ ] ID: UAT-ACC-004
- Priority: P1
- Area: Multi-therapist availability and calendar concurrency
- Client feedback summary: Confirm two therapists can share an instant without calendar interference or duplicate same-therapist slots.
- Required fix or validation: Provision `uat-therapist-20260924-b@talkspace.test` with a separate profile/availability and compare concurrent slot results.
- Owner / role responsible: Booking/integrations QA owner; staging administrator
- Environment: staging
- Current status: Open
- UAT steps: Offer the same WAT instant to both therapists, book concurrently, verify separate dashboards/events, then attempt duplicate booking for one therapist.
- Evidence required: Therapist IDs, slot keys, booking IDs, concurrency result, cleanup confirmation.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Optional; only required for duplicate-slot/multi-therapist scenarios.

### UAT-ACC-005 — Optional second client

- [ ] ID: UAT-ACC-005
- Priority: P1
- Area: Concurrent booking and package-balance isolation
- Client feedback summary: Confirm concurrent clients cannot both claim one therapist slot and cannot see or consume each other’s package balance.
- Required fix or validation: Provision `uat-client-20260924-b@talkspace.test` with a separate package and run a controlled race.
- Owner / role responsible: Booking/payment QA owner; staging administrator
- Environment: staging
- Current status: Open
- UAT steps: Submit both clients against one slot, inspect the winner/loser states, expire holds, consume package credits, and verify RLS isolation.
- Evidence required: Both booking attempts, final slot owner, package balances, authorization results, cleanup confirmation.
- Evidence link or screenshot reference: — To be added during staging UAT.
- Notes / blocker: Optional; only required for concurrency/package scenarios.

## Clarification tracker

- [ ] Confirm whether the new Lagos address replaces or supplements Abuja.
- [ ] Confirm the internal notification recipient audience.
- [ ] Confirm whether temporary holds should generate internal notices.
- [ ] Confirm whether custom-quote services are contact-only or bookable.
- [ ] Define “all Google Reviews” as provider-available or locally stored records.
- [ ] Assign Search Console submission and monitoring ownership.
- [ ] Approve retention/access policy for client, payment, intake, and UAT data.

## Documentation-only gate

- [ ] Do not mark an item UAT Passed, Production Ready, or Done without redacted staging evidence.
- [ ] Do not run migrations, deploy, send real messages, call live providers, alter production data, or force-push for this checklist.
- [ ] Follow `audit/*`/`feature/*` → `develop` → staging/UAT → approved release PR to `main`.
