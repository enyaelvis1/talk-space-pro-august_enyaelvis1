# Talk Space — General Client Feedback Implementation Checklist

Review date: 24 September 2026
Scope: consolidated implementation, decision, and UAT checklist for client feedback

This is the general implementation view across the existing feedback documents. It
does not replace the detailed test cases in the linked registers. “Implemented”
means that code or documentation exists locally; it does not mean that staging,
provider, email, payment, Google, or production acceptance has passed.

## Source documents

- [Original client feedback checklist](CLIENT_FEEDBACK_CHECKLIST.md) — earlier
  website, booking, services, pricing, journal, and polish requests.
- [Client feedback issue register](TALKSPACE_CLIENT_FEEDBACK_ISSUE_REGISTER.md) —
  `TS-001` through `TS-016`, based on code and migration inspection.
- [Client feedback UAT checklist](TALKSPACE_CLIENT_FEEDBACK_UAT_CHECKLIST.md) —
  granular booking, client-record, CMS, therapist, notification, reviews, and
  performance items.
- [Tracking checklist](TALKSPACE_CLIENT_FEEDBACK_TRACKING_CHECKLIST.md) — current
  staging readiness, priorities, and disposable-account requirements.
- [Current work audit](TALKSPACE_CURRENT_WORK_AUDIT.md) — implementation and risk
  summary supporting the status labels below.

## Status legend

- `[ ]` Implementation or decision still required.
- `[~]` Partially implemented, or implementation exists but needs a gap fix and
  evidence.
- `[x]` Implemented locally; still verify if the row is marked “UAT required”.
- `[!]` Blocked or dependent on an explicit product/client decision.

## 1. Highest-priority implementation queue

Complete these before treating the feedback batch as release-ready:

- [~] **Booking/payment integrity:** local payment, slot, token, transfer,
  duplicate-confirmation, and grouped-booking hardening is implemented; staging
  migrations and provider UAT remain required.
- [~] **Client record integrity:** incomplete contact commitments are rejected
  and successful payment reconciliation is idempotent; staging data-integrity
  evidence remains required.
- [~] **Confirmation and notification ordering:** Meet-link pending state,
  notification claims, reminders, and internal alerts are implemented locally;
  email/provider evidence remains required.
- [~] **Therapist access isolation:** role/profile linking, scoped dashboard and
  calendar access, Google revocation, and admin login revocation are implemented;
  cross-account staging UAT remains required.
- [~] **Canonical content and pricing:** code fallbacks, page seed content,
  footer/CMS migration, editable email bodies, canonical address, and explicit
  service-mode pricing are implemented locally; content-owner UAT remains
  required.
- [!] **Staging UAT:** blocked until a dedicated staging target, approved
  migrations, sandbox providers, disposable synthetic accounts, redacted
  evidence, and the release gate in Section 10 are available.

## 2. Earlier website and product feedback

These requests are recorded as implemented in the original checklist unless
otherwise noted. Keep them in regression testing while later feedback is merged.

### Homepage and services

- [x] Homepage shows nine focused areas of counselling care.
- [x] Add Infidelity Recovery Therapy and Organizational Counselling.
- [x] Split Premarital Counselling and Family Therapy into separate cards.
- [x] Services page contains the approved seven services in the requested order:
  Individual, Couple, Organizational, Premarital, Infidelity Recovery,
  Teen/Child, and Family Therapy.
- [x] Add imagery and descriptions for the two new services.

### Booking and payment copy/policy

- [x] Show the payment/booking confirmation copy requested by the client.
- [x] Surface the 48-hour reschedule/cancellation policy.
- [x] Allow booking within 24 hours where the slot is valid.
- [x] Require the “Anything you’d like us to know?” field and show its error
  state.
- [x] Reconcile the earlier booking-date/time policy with `BK-003`: remove only
  unnecessary preferred-date/time restrictions while retaining past-time,
  genuine conflict, timezone, and availability safeguards.

### Journal, pricing, and About page

- [x] Use “Journal” in navigation and page headings while retaining the `/blog`
  URL where required.
- [x] Migrate, edit, and SEO-optimize the approved journal posts, including
  metadata, headings, alt text, and internal links.
- [x] Group pricing into Single Sessions, Monthly Packages, and Specialized
  Packages.
- [~] Confirm every displayed price and Paystack link for the new pricing tiers.
  The application now resolves service-mode prices from the active catalogue;
  approved live values and provider links still require staging/content-owner
  verification.
- [x] Change the founding year from 2021 to 2017.
- [x] Update the historical About-page location wording and review downstream
  year/timeline references.
- [x] Resolve the older “Gbagada” wording against the newer approved Lagos
  address in local fallbacks, seed content, footer/contact content, and the
  additive reconciliation migration. Staging content-owner approval remains
  required for any already-edited CMS rows.

### Global polish and additional payment options

- [x] Apply the requested brand-color hover treatment to text links.
- [x] Review imagery and replace unsuitable stock/illustrative imagery where
  appropriate.
- [!] Complete Clarity Call details: approved copy, price, duration, and Paystack
  link. The service and 15-minute availability rule exist locally, but the
  approved commercial values and provider link were not supplied.
- [x] Show the approved business bank account details at checkout, including
  account name, bank, account number, reference instructions, and the handoff
  into the bank-transfer flow (`BK-005`, `BK-009`, `TS-016`). Staging must verify
  the configured values without exposing credentials in this repository.

## 3. Booking, payment, pricing, and slot integrity

These items are the main P0 implementation queue. Several IDs describe the same
end-to-end flow and should be implemented and tested together.

### Pricing and mode selection

- [~] **`TS-004` — One-month in-person price:** verify that the in-person
  `one_month_individual` price is ₦323,000 everywhere, while online remains
  ₦210,000. Local fallback and mode-aware resolution are implemented; verify
  the live service row, public pricing, booking, checkout,
  Paystack/bank-transfer amount, ledger, receipt, and admin display.
- [x] **`TS-005` — All in-person amounts:** give every service an explicit
  in-person policy: offered with a price, unavailable, or custom quote. Do not
  silently fall back to the online price. The service catalogue, booking,
  checkout, payment initialization, bank transfer RPC, and admin editing now
  use the mode-aware resolver; staging must verify each configured row.
- [~] Confirm the price matrix and Paystack links for all earlier pricing tiers
  and Clarity Call before release.

### Booking state, operations, and reservations

- [x] **`BK-001` / `TS-007` — Current operations:** show clearly labelled,
  refreshable current/today operations using Africa/Lagos day boundaries;
  exclude unpaid, incomplete, cancelled, and archived rows; keep an explicit
  upcoming view; align dashboard counts with the visible list.
- [x] **`BK-004` / `TS-015` — Slot leakage:** incomplete, failed, or unprocessed
  bookings must not occupy public or hidden/backend slots. Preserve real holds
  only for the approved lifecycle, expire them safely, and handle concurrent
  payment callbacks without double confirmation.
- [x] **`BK-007` — Incomplete booking token flow:** persist hold/resume tokens
  before returning them; enforce expiry, revocation, tamper resistance,
  single-use/replay behavior, and safe recovery when the original slot is gone.
- [x] **`BK-008` — Multiple therapists:** allow different therapists to be
  booked at the same time, including different services, while still rejecting
  overlap for the same therapist and respecting each therapist’s busy blocks.
- [x] **`BK-003` — Preferred date/time restrictions:** remove restrictions the
  client did not request, but retain valid availability, past-time, conflict,
  lead-time, and timezone rules after the client confirms the intended policy.

### Paystack and commitment

- [x] **`BK-006` / `TS-010` — Paystack confirmation:** validate exact amount,
  currency, reference, booking group, callback, webhook, admin recheck, retry,
  and duplicate delivery. One valid transaction must commit the intended booking
  group exactly once.
- [x] Fix and regression-test amount-unit handling. A local reproduction showed
  that an actual 199 kobo could be accepted against an expected 19,900 kobo;
  exact integer minor-unit validation now rejects mismatches before mutation.
- [x] **`TS-011` — Admin failure states:** distinguish provider not-found,
  wrong-mode/account, delayed, amount-mismatch, duplicate/already-confirmed, and
  booking-review-required states. Show stored reference, provider mode, next
  action, and whether commitment succeeded.
- [x] **`BK-002` — Client after payment:** successful Paystack commitment must
  create or update exactly one client record, including anonymous paid bookings,
  and recover safely if the client write is retried or initially fails.

### Direct bank transfer

- [x] **`BK-005` / `TS-016` — Direct transfer:** accept the approved transfer
  details/receipt/reference, place it in a separate review queue, and commit the
  booking/client/payment state only once after approval.
- [x] **`BK-009` — Bank Transfer page:** validate the form, upload/error/retry
  states, persistence, admin review, approval/rejection result, wrong amount,
  duplicate approval, and a slot becoming unavailable before approval.
- [!] Confirm who approves transfers, required proof/reference fields, review
  turnaround, client messaging, and whether receipt submission sends an internal
  review alert. Never treat a pending transfer as a confirmed booking.

## 4. Client records and data management

- [x] **`TS-009` — Registered-client prefill:** signed-in clients should receive
  name, email, phone, and relevant preferences in the booking form without
  overwriting deliberate edits. Preserve the client-to-appointment link.
- [x] **`CR-001` — Complete contact details:** reject or route incomplete records
  from sign-up, guest booking, admin creation/editing, import, and payment paths.
  No committed client may be unnamed or lack both phone and email requirements.
- [x] **`CR-002` — Storage and record transfer:** document where client records
  are stored and who can access them. Implement authorized export/download and
  validated upload/import with duplicate/update policy, partial-failure reporting,
  multiline data support, and preservation of existing records.
- [!] Decide whether record upload covers profiles only or also clinical
  documents/history. Do not infer this from the request; record the approved
  fields, file format, retention, and duplicate policy before implementation.
- [~] Test access denial for non-admin users and preserve payment links,
  booking references, and audit history during import/update.

## 5. CMS, address, email, and public content ownership

### Address, footer, and office locator

- [x] **`TS-001` / `AC-001` — Canonical Lagos address:** apply the approved
  address consistently to footer, contact, About/privacy content where relevant,
  in-person booking, receipts, confirmation emails, and admin previews.
- [x] **`TS-002` — CMS ownership:** publish a source-of-truth matrix for site
  details, footer settings, offices, seeded content, code fallbacks, and email
  locations. Show fallback/missing-row warnings where appropriate and remove
  duplicate stale constants after migration and UAT.
- [x] **`AC-002` — Footer wording:** remove the visible word “WhatsApp” while
  preserving the intended chat destination, number, accessibility, and layout.
  Verify this remains true on mobile and desktop.
- [x] **`AC-003` — Office locator label:** display the exact label “Talk Space
  Counseling, Lagos” for the second office locator, preserve the existing office,
  and verify the Lagos map destination. Confirm separately whether the external
  Google listing/pin is in scope.

### Editable email content

- [x] **`TS-003` — Admin-editable email bodies:** add sanitized, versioned body
  content with an allowlisted placeholder set, preview, publish/rollback, and
  audit history. Keep a safe code fallback when no published override exists.
- [~] Test booking, payment, reminder, review, and bank-transfer templates with
  WAT dates, Meet links, grouped bookings, missing optional values, and invalid
  placeholders in a staging email sink.
- [!] Confirm which internal recipients should receive review/failure alerts and
  which messages must go only to clients or therapists.

## 6. Therapist dashboard, calendar, and notification flow

- [x] **`TA-001` — Therapist access:** complete invite/password setup, therapist
  role and profile linking, route guards, session recovery, revocation, and
  denial for clients, unlinked users, and other therapists. A therapist must not
  access admin features without a separate admin role.
- [x] Preserve the implemented dashboard UX: therapist-only navigation, today
  and upcoming committed sessions, calendar status, Meet-link actions, pending
  Meet state, scoped appointments, and exclusion of unpaid holds/payment/CMS
  controls. Remaining work is smoke/UAT evidence and any action-permission gaps.
- [!] Define allowed therapist actions: view only, availability edits,
  completed/no-show/cancelled status, payment state visibility, and session
  notes. Apply least privilege and document the decision.
- [x] Complete per-therapist Google Calendar connection: signed short-lived
  links, connect/reconnect/disconnect, own-calendar isolation, busy-block
  availability, committed-booking event sync, cancellation/reschedule cleanup,
  retry controls, and audit events.
- [x] **`TS-006` — Urgent Meet links:** ensure an online booking has a Meet link
  before a confirmation claims it is ready, or expose a visible pending/review
  state with bounded retry and no misleading link in the message.
- [x] **`TS-014` — Confirmation and reminders:** send one complete confirmation
  after payment, booking, and Meet state are known; send reminders only for
  confirmed/unarchived bookings; include the correct client/therapist recipients,
  WAT time, and Meet link when available.
- [x] **`NI-001` — Incomplete booking alerts:** do not send internal booking
  confirmations or calendar invitations for incomplete attempts. Implement a
  bounded, secure client completion reminder that stops after payment, transfer
  approval, cancellation, or expiry and is deduplicated across retries.
- [~] Test connected and unconnected therapist flows: calendar event/busy-block
  behavior, email fallback, Meet failure/retry, and cross-therapist isolation.

## 7. Time, SEO, reviews, and performance

### Africa/Lagos date and time

- [x] **`TS-008` — WAT standardization:** keep stored instants in UTC/timestamptz
  and centralize all user-facing date/time formatting and local date-key
  conversion on `Africa/Lagos` for public booking, admin, email, and Google
  payloads.
- [x] Add boundary tests for Lagos midnight, same-day booking, 10:30 slots,
  browser/server timezone differences, daylight/timezone assumptions, and Google
  Calendar display.

### Sitemap and Search Console

- [x] **`TS-013` — Indexing ownership:** document the indexability matrix,
  canonical URL policy, sitemap/robots ownership, and the person/team responsible
  for Search Console submission and monitoring. Keep admin, account, payment,
  and other private routes excluded.
- [~] Verify sitemap URLs, robots output, status codes, canonicals, published vs
  draft content, and the external Search Console property separately.

### Blog and Google Reviews

- [x] **`PR-001` — Public blog tags:** hide tags on public article/list views
  while retaining editable tag metadata in admin. Run the signed-out mobile and
  desktop regression checks.
- [x] **`TS-012` / `PR-002` — Google Reviews:** define the authorized source,
  location scope, full-sync vs export meaning, provider limits, pagination,
  cadence, stable identity/update behavior, last-refresh/count reporting, and
  retry behavior. Repeat sync must not duplicate reviews, and provider failure
  must preserve the existing published set.
- [~] Verify multi-page retrieval, updated/new reviews, CSV download, public
  rendering, authorization failure, and recovery with approved provider access.

### Mobile image delivery

- [~] **`MP-001` — Mobile performance:** establish a repeatable cold-load
  baseline on home, pricing, therapists, journal, and booking; inspect delivered
  image dimensions/bytes, responsive variants, compression, caching, priority,
  and layout stability; optimize the measured bottlenecks.
- [ ] Re-run comparable mobile audits and check 360px/390px plus desktop views.
  Record agreed FCP/LCP/TBT/CLS and image-byte targets; do not claim success from
  the existence of an image component alone.

## 8. Decisions required before dependent implementation

Record the answer in the detailed UAT checklist and here before closing the
dependent item.

| Decision | Affected work | Decision required |
| --- | --- | --- |
| C1 | `BK-001` | Should paid cancelled/no-show sessions appear in a separate history view? |
| C2 | `BK-003` | Which preferred-date/time limits should be removed, and which real availability safeguards remain? |
| C3 | `BK-004`, `BK-005`, `BK-007` | What happens when payment arrives after another client takes the slot: reselection, refund, credit, or support handling? |
| C4 | `BK-005`, `BK-009`, `NI-001` | Who approves transfers, what proof is required, what is the turnaround, and which internal alert is allowed? |
| C5 | `BK-007`, `NI-001` | Resume-link lifetime, reminder timing/count/channel, and eligibility including pending transfers. |
| C6 | `BK-002`, `CR-002` | Profile-only versus clinical records, intended fields/format, duplicate/update policy, and paid-guest handling. |
| C7 | `AC-003` | Site office label only, or also the external Google listing/address/pin? |
| C8 | `TA-001` | Therapist self-service actions and visibility boundaries. |
| C9 | `TS-012`, `PR-002` | Meaning of “full download”, authorized Google source/location, and curated versus every review. |
| C10 | `MP-001` | Representative pages, device/network conditions, metric/image budgets, and visual-quality tolerance. |
| Address policy | `TS-001`, `TS-002`, `AC-001`, `AC-003` | Final canonical Lagos wording and whether historical Gbagada wording remains anywhere. |
| Pricing policy | `TS-004`, `TS-005` | Explicit treatment of unavailable, custom-quote, online, and in-person prices. |
| Email ownership | `TS-003`, `TS-014`, `NI-001` | Which bodies/recipients are admin-editable and which remain system-controlled. |

## 9. Verification checklist for each implemented item

- [x] Add or update automated unit/contract tests for the changed state,
  permission, pricing, timezone, or content contract.
- [x] Run lint, type checking/build, and the relevant test subset; record any
  baseline failures separately from new failures.
- [ ] Deploy only to the approved staging target after the feature branch has
  passed review; never use production data for feedback testing.
- [ ] Apply only approved additive migrations to a dedicated staging project
  after backup/snapshot proof, rollback ownership, and migration-order review.
- [ ] Use the disposable synthetic accounts in
  [TALKSPACE_DISPOSABLE_UAT_ACCOUNTS.md](TALKSPACE_DISPOSABLE_UAT_ACCOUNTS.md)
  and secure runtime credentials. Do not put credentials in `.env`, commits,
  screenshots, or test artifacts.
- [ ] Run the linked positive, negative, retry, duplicate, expiry, timezone,
  permission, and mobile cases for each affected item.
- [ ] Record staging URL, commit/build, migrations, tester/date, references,
  result, redacted screenshots/logs, UAT acceptor, and PR approval.
- [ ] Re-test every affected item after later payment, booking, notification,
  migration, or provider changes.
- [ ] Clean up synthetic Auth users, bookings, payments, files, emails, calendar
  events, and provider test data after UAT; verify no production data changed.

## 10. Release gate

- [ ] Feature branch reviewed and merged to `develop` by pull request.
- [ ] Staging/UAT passes on the exact reviewed `develop` revision.
- [ ] All P0 items have evidence and client/owner acceptance.
- [ ] P1/P2 items are either accepted, explicitly deferred, or have an approved
  follow-up owner/date; no “implemented locally” status is treated as closure.
- [ ] Provider checks pass or their known limitations are documented: Paystack,
  Google Calendar/Meet, Google Reviews, email delivery, Search Console, and any
  file storage used by client imports.
- [ ] Open a separate approved release PR from `develop` to `main` only after
  staging/UAT acceptance. Never merge a feature branch directly into `main`.
