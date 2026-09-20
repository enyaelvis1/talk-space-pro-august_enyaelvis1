# Client booking, payment, notification and Google Reviews checklist

Focused remediation checklist for the client-reported issues from 16 September 2026.
Every implementation item requires staging validation and evidence before production.

## Status legend

- [ ] Not Started
- [~] In Progress
- [x] UAT Passed
- [!] Blocked / Needs Decision

## Shared acceptance rules

- A paid and verified booking must appear consistently in the correct client, admin, and
  therapist views.
- A grouped payment must be verified against the single stored checkout total and provider
  reference; individual appointment rows must not be verified as separate full payments.
- Confirmation emails must be sent only after commitment and must include every purchased
  session and the Google Meet link when available.
- Email failures must be visible in the admin delivery log and retryable without duplicating
  bookings, payments, credits, or notifications.
- Google Reviews export must include the complete stored review set and identify records by a
  stable provider ID so updates do not create duplicates.

## 1. Booking and dashboard visibility

### [~] CL-001 — Reconcile upcoming booking counts and lists

- Priority: P0
- Area: Client and therapist booking views
- Client feedback: Dashboard shows four upcoming bookings, but the Upcoming page shows no sessions even though nine paid and verified sessions exist.
- Required fix: Use one committed-booking query contract for dashboard counts and upcoming lists, scoped to the signed-in owner or therapist, with consistent timezone and future-date rules. Include grouped/package-created appointments.
- Acceptance criteria: Every paid/verified future appointment appears exactly once in the appropriate Upcoming page; dashboard counts equal list totals; cancelled, archived, unpaid, and expired holds remain excluded.
- High-level UAT steps: Create/identify nine paid verified sessions across grouped payments, reload dashboard and Upcoming page, compare counts, test client and therapist accounts, and verify timezone boundaries.
- UAT evidence required: Staging URL/build, account role, booking references, dashboard screenshot, Upcoming screenshot, and query/count comparison.
- Status: In Progress
- Notes: Client appointment loading now filters to committed statuses and falls back to an exact authenticated email match for legacy paid rows missing client_id. Admin summary and upcoming/today lists now use confirmed, unarchived appointments consistently. Staging data verification remains required.

## 2. Notifications and Google Meet links

### [~] CL-002 — Restore committed booking email notifications

- Priority: P0
- Area: Client, therapist and internal notifications
- Client feedback: Talk Space and the client received no notices for purchased/booked sessions or Google Meet links.
- Required fix: Verify the committed booking notification pipeline, grouped-payment email payload, recipient resolution, Meet sync ordering, provider configuration, delivery logging, and retry behavior.
- Acceptance criteria: One committed grouped purchase sends one complete client confirmation, therapist details for each assigned session, and the configured internal notification. Emails contain all sessions and any available Meet links. Failed sends are logged and retryable.
- High-level UAT steps: Complete a staging grouped purchase, inspect client/therapist/internal inboxes and delivery logs, test Meet sync success and failure, retry a failed email, and repeat verification/callbacks.
- UAT evidence required: Redacted email screenshots, delivery-log records, booking/payment references, Meet link, recipient list, and retry result.
- Status: In Progress
- Notes: Callback, webhook, delayed recheck, and admin verification now share the payment notification helper. Confirmed grouped rows send client payment emails and configured internal booking notices after Google sync. Provider delivery and therapist-recipient policy still require staging UAT.

## 3. Payment grouping and Paystack verification

### [~] CL-003 — Verify grouped payments against the exact checkout total

- Priority: P0
- Area: Paystack payment confirmation
- Client feedback: Three sessions paid together at 90,000 each were verified as two 90,000 payments and one 270,000 payment.
- Required fix: Treat the grouped payment as one provider transaction with one immutable checkout total. Verify Paystack amount/currency once per payment group, then commit all linked appointments idempotently; never verify each child appointment as a separate full transaction.
- Acceptance criteria: A 3-session checkout of 270,000 is accepted only when Paystack reports the exact stored total in the same minor-unit/currency representation. Rechecking any child reference cannot double-count, split, or inflate the group. Partial/mismatched amounts fail closed and enter review.
- High-level UAT steps: Create grouped purchases of 2 and 3 sessions, run callback/webhook/admin Check Paystack in different orders, repeat verification, test mismatch and duplicate references, and compare stored/payment/provider totals.
- UAT evidence required: Redacted Paystack response, stored checkout total/currency, group reference, child booking references, admin verification screenshots, and idempotency assertions.
- Status: In Progress
- Notes: Existing group-total validation is covered by regression tests; the admin ledger now displays both each appointment amount and the aggregated checkout total. Staging must verify real Paystack callback/webhook/recheck ordering and the client-facing paid amount.

## 4. Google Reviews download and update

### [~] CL-004 — Support full Google Reviews download and stable updates

- Priority: P1
- Area: Admin/CMS Google Reviews
- Client feedback: Full download of Google Reviews and how to update new ones.
- Required fix: Retrieve the complete available provider result set, retain stable provider review IDs, support full CSV download, and upsert refreshed reviews without duplicate quote-based records.
- Acceptance criteria: Admin can download all stored Google Reviews; importing refreshed results updates existing reviews by provider ID and adds new reviews; pagination/next-page handling is explicit and no silent 50-row ceiling remains.
- High-level UAT steps: Import a multi-page fixture, download CSV, change an existing review and add a new one, re-import, and confirm counts, IDs, rendered public reviews, and audit records.
- UAT evidence required: Before/after counts, downloaded CSV, provider IDs, import result, admin screenshots, public rendering screenshot, and audit entry.
- Status: In Progress
- Notes: Business Profile pagination remains enabled, stored export capacity is 2,000 reviews, and Places fallback reviews now receive stable IDs. Provider limits and full-result staging fixture still require confirmation.

## 5. Cross-system verification and rollout

### [~] CL-005 — Complete staging Playwright and release gate

- Priority: P0
- Area: UAT and release control
- Client feedback: Validate the corrected end-to-end behavior.
- Required fix: Add/extend Playwright coverage for paid grouped booking visibility, notification-facing confirmation state, Google Meet link display, payment idempotency, and Reviews download/update.
- Acceptance criteria: Desktop and mobile Playwright journeys pass on staging with isolated test data. No production promotion occurs until evidence is attached and this checklist is UAT Passed.
- High-level UAT steps: Run anonymous boundary, client authenticated, admin authenticated, therapist authenticated, grouped payment, retry, and Reviews flows; capture screenshots and references.
- UAT evidence required: Playwright output, screenshots, staging commit/build, migration state, test accounts by role, booking/payment references, and reviewer approval.
- Status: In Progress
- Notes: Local Playwright anonymous boundary and visual smoke tests pass on port 8083. Credentialed client/admin/therapist, real payment, email delivery, Meet sync, and Reviews UAT remain staging-only.

## Clarifications needed before production

- Confirm whether internal notification means one shared Talk Space address or separate admin/therapist recipients.
- Confirm whether Google Reviews means all reviews available from the provider or all reviews currently stored in Talk Space.
- Confirm the approved client reminder timing/copy for incomplete bookings; this checklist does not enable incomplete-booking reminders.

## Git workflow

1. Implement on `feature/client-booking-payment-notifications` from `develop`.
2. Run focused tests, full tests where available, build, lint, and Playwright locally.
3. Open a PR to `develop`; do not push directly to `main`.
4. Validate the exact merged revision on staging and attach evidence above.
5. Promote `develop` to `main` only through an approved release PR.
