# Client feedback batch test guide

## Scope and release boundary

Implementation branch: `feature/feedback-batches-integrity`, based on `develop`.
Existing workspace changes were committed first (`1d663ce`). CSV work is in
`3c08cf3`; payment/slot integrity is in `acfb7ee`, followed by verification repairs.

This is a partial implementation handoff, not approval to release all feedback.
The [main checklist](TALKSPACE_CLIENT_FEEDBACK_UAT_CHECKLIST.md) now records
10 items Ready for UAT, 8 In Progress and 1 Not Started. None has production sign-off.

- Keep real available-slot selection, without arbitrary future-date caps.
- Import client profiles through CSV, not clinical notes or intake attachments.
- Do not schedule completion reminders until timing is agreed.
- Retain successful payments when the requested slot is lost, and queue admin
  rescheduling/refund review. Do not charge again or send a confirmed-session email.

## Local checks

Run from the project root:

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The suite includes real-component browser tests, CSV parser/round-trip tests,
minor-unit/group-total payment tests and a rendered payment-review email test.
The booking-integrity test creates and destroys its own PostgreSQL cluster; it
never reads the application database connection variables. Set `PG_TEST_BIN` to
the PostgreSQL binary directory when it is not `/usr/lib/postgresql/16/bin`.
Chromium must be installed (or set `CHROME_PATH`) for the browser checks.

Local execution: 175 tests passed with no failures or skips. Typecheck and build
passed. Lint passed with seven existing Fast Refresh warnings. The build still
reports large chunks and existing bundler/API deprecations; a passing build does
not establish that the mobile performance target is met.

The dev server also reports an existing missing CSRF-middleware warning. Review
request-origin protection before release; the passing checks do not establish
that authenticated mutations are protected against cross-site requests.

Component evidence uses synthetic data and a stubbed admin shell, not a real
authenticated admin session:

- [Desktop booking picker](../output/playwright/feedback/slots-1280.png)
- [Mobile booking picker](../output/playwright/feedback/slots-390.png)
- [Desktop admin shortcuts](../output/playwright/feedback/admin-1280.png)
- [Mobile admin shortcuts](../output/playwright/feedback/admin-390.png)
- [Public booking desktop](../output/playwright/feedback/public-book-desktop.png)
- [Public booking mobile](../output/playwright/feedback/public-book-mobile.png)

Local dev server: `http://127.0.0.1:8084/book`. Its Vite cache and the browser-test
caches are isolated, so rerunning tests does not invalidate the running app.
The public page smoke test is read-only; it does not verify payment, email,
authenticated CSV persistence, or Google OAuth.
The fresh public-page browser run opened the service menu successfully, reported
no JavaScript/request errors and found no horizontal overflow at 390 px.

## Staging setup

1. Confirm the application points to a staging database, Paystack test keys and
   test-only email recipients. Do not run these scenarios against production.
2. Back up staging and review pending migrations. Apply the new
   `20260913110000_reserve_only_committed_bookings.sql` migration there. It has
   only been executed locally against an isolated schema fixture, not a shared
   staging or production database or a full production migration history.
3. Give two active test therapists the same available time, and assign them to
   both the same service and a second service. Record the services' prices and buffers.
4. Use two client accounts and one admin account. Use synthetic contacts with
   valid name, email and phone values. Capture evidence without passwords,
   access/manage tokens, clinical notes, or private production client data.

## What to test

### A. CSV profiles (CR-001, CR-002)

1. As admin, export Clients and confirm all pages are included. Confirm export
   includes full name, email, phone, CRM fields and therapist assignment IDs.
2. Prepare a small CSV with `full_name,email,phone` headers. Include a quoted name
   containing a comma and a multiline quoted address. Preview it; cancel and
   confirm no client was created.
3. Preview a file with missing contact fields or duplicate emails. Confirm row
   errors are shown and Import is disabled. Files larger than 2 MB or with over
   2,000 profiles must be rejected.
4. Import a valid file after confirmation. Reload Clients; export again and
   compare values. Reimport with Skip existing; verify no duplicate clients.
5. Choose Update existing explicitly, change a contact, and omit optional
   columns. Verify the contact updates while omitted fields remain unchanged.
6. Repeat as a non-admin: import/export mutations must be denied. Existing
   malformed client records still require genuine contact-data remediation.

Evidence: preview/error screenshots, synthetic emails, imported counts, and
redacted export comparison. No clinical-note import is part of this batch.

### B. Payment amounts and registered clients (BK-002, BK-006)

1. Pay for one session using Paystack test mode. Verify the exact NGN amount in
   kobo against the payment row and the resulting registered client's contacts.
2. Select multiple sessions and pay once. Recheck from both the root payment and
   a child row in Admin Payments. The expected amount must be the group total,
   not one session's amount.
3. Replay/recheck a successful result. Confirm it does not create another
   package, consume another session or send a duplicate confirmation.
4. Verify a four-session website package has three remaining after its initial
   confirmed booking. A separately created manual package still starts unused.

Evidence: checkout total, test provider reference, all linked booking references,
admin payment screenshot, client row and package balance. Do not falsify provider
responses or send test webhooks to production.

### C. Slots, conflicts and therapist identity (BK-001, BK-004, BK-008)

1. Client A starts checkout and leaves it unpaid. In a second browser, verify the
   same therapist/time is still available. It must not appear in the default
   operational calendar or trigger a Talk Space incomplete-booking alert.
2. Client B pays for that time. Verify only B's appointment confirms and the slot
   disappears for that therapist, while the other therapist remains available.
3. Finish A's test payment after B. Verify both payments remain recorded as
   succeeded, only B's appointment is confirmed, and A appears in Payments >
   Pending review with a rescheduling/refund warning.
4. Verify A's receipt says payment received/booking under review, with no Meet
   link, confirmed session time, or package activation. Do not retry payment.
5. Repeat with a multi-session checkout containing one conflicting time. No
   subset of that checkout should be silently confirmed.
6. Book both therapists at the same time. Verify their IDs remain distinct in
   selection, appointment and intake records. Repeat through separate checkouts
   for different services. Mixed services in one checkout are not supported.
7. Test buffers, Google busy blocks, archived bookings and rescheduling against
   the full staging schema. The isolated SQL fixture does not prove those
   existing triggers/integrations work together in production.

Evidence: both client/payment references, before/after availability, operational
calendar, admin review queue and redacted emails. In-app conflict resolution and
automated refund processing are not complete; BK-009 remains In Progress.

### D. Existing features to verify without rebuilding

1. Edit the footer address; reload the public footer. Confirm icon/number display
   has no visible WhatsApp prefix. Preserve saved CMS content and images.
2. Confirm public blog cards/articles hide tags while admin editing retains them.
3. Invite a new therapist, set a password, and open `/therapist`. Confirm another
   therapist's appointments and `/admin` are denied.
4. Connect one test therapist's Google Calendar and leave another unconnected.
   Verify therapist-specific busy times, booking sync, Meet creation and email
   fallback. These external integrations have not been exercised by this batch.

## Remaining work and UAT gate

The next batch must address bank-transfer RPC overloads, per-session token
forwarding, structured transfer references and atomic grouped retries. Also
remaining: unpaid-lead separation, historical contact repair, full Google Reviews
pagination/update/export and measured mobile performance improvements. Review
the existing Lagos-label PR #150; reconcile overlap with PRs #149 and #151.

For each tested item, add staging URL/build SHA, tester/date, result, references
and redacted screenshots to the main checklist. Only then mark UAT Passed or
Production Ready. A reviewed feature PR goes to `develop`; promotion to `main`
requires a separate approved release PR. No production migration or deployment
has been performed during this work.
