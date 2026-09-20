# Talk Space Client Feedback Checklist + UAT Gate

Reviewed 2026-09-13 against `develop` at `754ea2b`. This is a documentation-only review of the 19 client feedback items. No fixes, migrations, staging deployment, or production release are authorized by this checklist task.

Existing IDs are retained for continuity with implementation branches. The earlier checklist marked several items Done while still requiring UAT evidence. Those completion claims are corrected below. Code presence, a passing source test, or an open PR is not staging acceptance. No item currently has sufficient linked evidence here for production approval.

## Current implementation audit

The following audit compares the checklist with the current `develop` source, migrations and tests. "Implemented" means that the main code path exists; it does not mean that staging acceptance or production readiness has been demonstrated.

| ID     | Current state                       | Remaining implementation or verification work                                                                                                                                                             |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BK-001 | Partial implementation              | Verify paid-only visibility across admin lists, counters, search and therapist views; confirm the intended cancelled/no-show history behavior.                                                            |
| BK-002 | Partial implementation              | Add or prove recovery for failed client writes, incomplete contact data and replayed callbacks; test returning-client deduplication and approved transfers.                                               |
| BK-003 | Policy unresolved                   | Decide which lead-time, horizon, increment and timezone restrictions are actually unnecessary before changing validation; then run boundary UAT.                                                          |
| BK-004 | Partial implementation              | Apply and verify `20260913110000_reserve_only_committed_bookings.sql`; confirm whether active holds and pending payments must remain excluded from availability, and test atomic late-payment resolution. |
| BK-005 | Partial implementation              | Verify exact amount/currency/reference checks, duplicate approval, slot loss and direct/offline payment handling on staging.                                                                              |
| BK-006 | Implementation present, UAT missing | Run Paystack test, callback, webhook, admin recheck and grouped-checkout cases, including the 19,900-versus-199 minor-unit negative case and replay/idempotency.                                          |
| BK-007 | Partial implementation              | Complete end-to-end resume, expiry, revocation, replay, stale-slot and payment-after-expiry verification; keep incomplete tokens separate from management tokens.                                         |
| BK-008 | Partial implementation              | Verify multi-therapist UI grouping, cross-service allocation, buffers, busy blocks, calendar sync and concurrent confirmation on staging.                                                                 |
| BK-009 | Partial implementation              | Apply and verify the transfer-reference migration/RPC, mobile retry behavior, persisted receipt/reference, review copy and approval/rejection audit flow.                                                 |
| CR-001 | Partial implementation              | Validate every booking, admin, import and payment path; create a remediation workflow for existing incomplete records without inventing contact data.                                                     |
| CR-002 | Partial implementation              | Execute the CSV preview/import/export paths, verify multiline/quoted data, duplicate/update policy, permissions, partial-write rollback and retry behavior.                                               |
| AC-001 | Ready for UAT                       | Verify save, reload, cache invalidation, public rendering, mobile wrapping and preservation of unrelated content/images.                                                                                  |
| AC-002 | Ready for UAT                       | Verify the visible label, keyboard activation, accessible name and WhatsApp destination on mobile and desktop.                                                                                            |
| AC-003 | Implementation present, UAT missing | Verify the exact Lagos label, map destination, fallback/CMS parity and unchanged Abuja office; confirm the external Google listing separately.                                                            |
| TA-001 | Partial implementation              | Complete invite/recovery/revocation, therapist action scoping, role isolation, OAuth reconnect/disconnect, calendar sync and unconnected-calendar fallback tests.                                         |
| NI-001 | Partial implementation              | Confirm suppression of incomplete internal alerts and calendar invites; agree and implement the bounded client reminder journey, deduplication and stop conditions.                                       |
| PR-001 | Ready for UAT                       | Verify signed-out public listing/article rendering and retained editable admin metadata across mobile and desktop.                                                                                        |
| PR-002 | Implementation incomplete           | Add paginated retrieval, stable provider identity/update handling and an explicit full-export scope; remove the 50-review ceiling only if the agreed product scope requires it.                           |
| MP-001 | Not started                         | Establish repeated mobile baselines, image-byte/network evidence, LCP/FCP/TBT/CLS targets, responsive crop checks and custom-upload URL coverage.                                                         |

No row above should be marked `UAT Passed`, `Production Ready` or `Done` until its staging evidence is attached using the gate below. The older detailed findings and item notes remain below as supporting context; this table is the current implementation-routing summary.

## Review findings and remaining work

- **P0, BK-004/BK-005:** Hiding unpaid rows does not release capacity. The checked-in `list_available_slots` SQL excludes holds and pending payments, and the original exclusion constraint reserves those states. See [availability SQL](../supabase/migrations/20260718040210_8c74e8af-a1e6-452d-ab1f-62e74de43187.sql) and [booking foundation](../supabase/migrations/20260715200000_booking_foundation.sql). Database deployment state still needs staging verification.
- **P0, BK-006:** [payment-validation.ts](../src/lib/payment-validation.ts) guesses major/minor units using divisibility by 100. A local read-only reproduction accepted an actual 199 kobo against an expected 19,900 kobo. This contradicts exact amount verification and requires a fix before UAT approval.
- **P0, CR-002; P1, CR-001:** [client import](../src/lib/clients.functions.ts) permits missing names/phones, splits CSV by physical lines, and skips existing emails. Multiline CSV, complete contact validation, duplicate/update behavior, and safe retry need review before declaring import/export complete.
- **P0, BK-008:** Database availability already filters by therapist ID. Investigate time-option grouping, allocation, and concurrent confirmation as well as SQL; do not assume the fault is solely a global database lock. [PR #149](https://github.com/enyasystem/talk-space-pro-august/pull/149) is open and has not been treated as accepted.
- **P1, PR-002:** [review import](../src/lib/admin.functions.ts) fetches one page, merges by quote text, and limits stored results to 50. Full retrieval and updating an existing review are not demonstrated.
- **Release tracking:** All 19 items still require staging evidence and approval. AC-001, AC-002, and PR-001 have code ready for UAT; 15 items have partial work or unresolved gaps; MP-001 needs a new measured performance pass.

The original workspace contains uncommitted client-management code and a CR-002 status update. They are preserved in that workspace and excluded from this documentation branch. Its local Ready for UAT claim must be reconciled with import validation and staging evidence before sign-off.

## Git workflow

1. Fetch and fast-forward pull latest `main` and `develop`; do not rewrite pushed history. Both were already current when reviewed.
2. Create this focused branch from `develop`: `docs/talkspace-client-feedback-uat-checklist`. This explicitly requested documentation branch is the exception to the usual implementation branch naming.
3. Change only `docs/TALKSPACE_CLIENT_FEEDBACK_UAT_CHECKLIST.md`. Preserve unrelated changes; use a separate worktree when necessary.
4. Commit with a Conventional Commit and open a documentation PR targeting `develop`. Do not merge or push directly to production.
5. For each future implementation, use a focused `feature/<item-id>-<short-name>` branch from current `develop` and a reviewed PR to `develop`. Link its PR and commit in the item's evidence.
6. Validate every implemented item on staging, including any database migration. A feature PR merged into `develop` does not authorize production.
7. Promote `develop` to `main` only through a separately reviewed release PR after the gate below passes and the user approves.

## Status and priority definitions

| Status           | Meaning                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Not Started      | The remaining feedback-specific work has not started; reusable foundations may exist.                                |
| In Progress      | Partial implementation, an open implementation PR, or a verified gap remains. This review does not authorize coding. |
| Ready for UAT    | Implementation is available for staging validation; acceptance has not been demonstrated.                            |
| UAT Passed       | All item criteria pass on the recorded staging build, with linked evidence and named acceptance.                     |
| Production Ready | UAT Passed, dependencies pass, and release review/approval is recorded.                                              |
| Done             | Approved production release is deployed and a production smoke check is recorded.                                    |

P0 blocks release because it affects payment, booking integrity, client data, or access. P1 is a required functional/operational improvement. P2 is content/presentation work. All priorities follow the same production gate. Heading checkboxes remain unchecked until Done; the Status field is authoritative.

## Staging UAT and production gate

Before testing, record the staging URL, commit/build, applied migrations, test accounts, and tester. Use synthetic client records, Paystack test transactions, and designated test Google accounts. Never put passwords, raw booking/invite tokens, OAuth secrets, or real client records into this document or a public PR.

For each item:

- Implementation and appropriate automated checks are complete; staging build and required migrations pass.
- Its high-level UAT cases, negative cases, and affected dependencies pass on that exact staging revision.
- Evidence is linked in the item: screenshots, booking/payment references, logs or exports as applicable, expected/actual results, test date, tester, and acceptance owner.
- Status is UAT Passed or Production Ready, and the implementation/release PRs are reviewed and approved.
- The user approves the release PR from `develop` to `main`; no direct production push bypasses this gate.
- After deployment, record the release and production smoke result before marking Done.

A failed criterion returns the item to In Progress. A relevant change after UAT requires retesting against the new staging revision. Missing evidence is an unmet gate, not a pass. An unrelated passing screenshot cannot close an item.

Use this evidence format in each item's UAT evidence entry:

`Staging URL | commit/build | migrations | test date/tester | case/results | artifact links | synthetic booking/payment refs | UAT acceptor/date | PR approval | release/smoke result`

### Shared acceptance rules

- Only verified successful payment, approved bank transfer, or redemption of already-paid session credit can reserve an appointment. Previously purchased credits must be validated and consumed exactly once.
- Draft, initiated, abandoned, failed, and awaiting-transfer-confirmation bookings do not reserve capacity, including hidden/backend allocation paths. A payment review queue is separate from the operational bookings view.
- Recheck availability atomically at payment/transfer commitment. Two clients paying for the same therapist/time cannot both receive confirmation. Preserve proof of payment and use an agreed resolution path when payment succeeds after capacity is taken.
- Successful committed bookings create/update the correct client record without duplicates. Preserve existing imported/legacy records; do not delete them merely because they lack an online payment history.
- Compare explicit currency and integer minor units against the stored checkout total across initialization, callback, webhook, admin recheck, and bank review. Never infer units from an amount's shape.
- Availability is per therapist across services and modes, including duration, buffers, and that therapist's busy calendar. Different therapists may work at the same time.
- Content/data migrations must preserve existing admin content and images. No reseeding or destructive replacement of production content.
- No incomplete booking sends a confirmed appointment, Meet invitation, or internal booking alert. Client completion reminders must stop after commitment and must not promise a reserved slot.

---

## 1. Booking, payment and slot integrity

### [ ] BK-001 - Hide unpaid/incomplete bookings from operations

- ID: BK-001
- Priority: P0
- Area: Booking, payment and slot integrity
- Client feedback: Unpaid or incomplete bookings must not show on the booking operation page. Only paid/completed bookings should show.
- Required fix: Apply verified commitment filtering consistently to operational lists, calendar counts, search, and therapist views; keep transfer review separate.
- Acceptance criteria: Drafts and unpaid attempts remain absent after reload and filtering. Valid paid, credit-funded, and approved-transfer sessions appear. An appointment status alone cannot make an unpaid record operational.
- High-level UAT steps: Create unpaid, failed, paid, package-credit, and pending/approved-transfer examples. Compare operations, counters, and therapist views; reload and search each reference.
- UAT evidence required: State matrix, booking/payment references, screenshots of operations/counts and the separate transfer queue.
- UAT evidence: Pending; no staging result linked.
- Status: In Progress
- Notes: [booking-calendar.ts](../src/lib/booking-calendar.ts) filters by status and includes cancelled/no-show history. Confirm paid-history placement (C1); visibility is distinct from slot blocking in BK-004.

### [ ] BK-003 - Remove unnecessary preferred date/time restrictions

- ID: BK-003
- Priority: P1
- Area: Booking, payment and slot integrity
- Client feedback: Remove restrictions on preferred date and preferred time on Book a Session page.
- Required fix: Identify and remove the agreed unnecessary date/time limits in UI and server validation without bypassing real therapist availability.
- Acceptance criteria: All approved future date/time choices are selectable and reach checkout. Invalid/past times and genuine therapist conflicts receive clear feedback. If free-text preferences are requested, they do not imply a confirmed reservation.
- High-level UAT steps: Test the earliest allowed time, a distant future date, today, an unavailable slot, and mobile date entry. Check submitted times in Africa/Lagos and another browser timezone.
- UAT evidence required: Agreed date/time policy, boundary-case screenshots, submitted booking references and resulting times.
- UAT evidence: Pending; policy and staging cases needed.
- Status: In Progress
- Notes: [book.tsx](../src/routes/book.tsx) still uses a minimum date and available-time choices; SQL also applies lead time and 15-minute increments. Resolve C2 before changing those rules. Earlier Done status was unsupported.

### [ ] BK-004 - Stop incomplete bookings reserving slots

- ID: BK-004
- Priority: P0
- Area: Booking, payment and slot integrity
- Client feedback: Incomplete/unprocessed bookings must not occupy booking slots in hidden/backend sections.
- Required fix: Remove draft/pending states from reservation and availability blocking, including database constraints; add atomic capacity checks at commitment.
- Acceptance criteria: Another client can select a slot immediately after an unpaid attempt, without waiting for expiry/cleanup. Pending bank transfers also do not block. Concurrent successful confirmations for one therapist/time cannot create overlapping appointments.
- High-level UAT steps: In two browsers choose the same therapist/time; abandon one checkout and verify availability immediately. Repeat with failed and pending-transfer attempts. Race payment confirmations, then test a late callback after another client has paid.
- UAT evidence required: Before/after slot queries, two-browser captures, payment/booking references, database constraint results, and losing-payment resolution.
- UAT evidence: Pending; source review confirms blocking remains.
- Status: In Progress
- Notes: Existing SQL explicitly blocks hold/pending_payment states. Dependencies: BK-005, BK-006, BK-007, BK-008; C3 must define late-payment resolution. Hiding calendar rows is insufficient.

### [ ] BK-005 - Support approved direct bank transfers

- ID: BK-005
- Priority: P0
- Area: Booking, payment and slot integrity
- Client feedback: Add support for clients who pay by direct bank transfer.
- Required fix: Complete submission, admin review, approval/rejection, and commitment for checkout transfers and payments received directly outside the website.
- Acceptance criteria: Submission alone never confirms payment or reserves capacity. Authorized admin verifies reference, currency, amount and intended service/sessions. Approval commits once; rejection leaves capacity free; duplicate approval is harmless. Standalone credits are not consumed until a session is booked.
- High-level UAT steps: Submit a receipt/reference; inspect review queue and free slot; reject one transfer and approve another. Test wrong amount, duplicate approval, direct/offline payment, and a slot taken before approval.
- UAT evidence required: Synthetic receipt/reference, pending/approved/rejected screenshots, audit actor/time, booking/client record and credit balance.
- UAT evidence: Pending; no approval-cycle evidence linked.
- Status: In Progress
- Notes: Transfer UI and admin functions exist in [payments.functions.ts](../src/lib/payments.functions.ts). Pending-state database blocking fails BK-004. Agree C3/C4; review BK-009 alongside this item.

### [ ] BK-006 - Correct Check Paystack amount verification

- ID: BK-006
- Priority: P0
- Area: Booking, payment and slot integrity
- Client feedback: Fix admin payment page Check Paystack error: "Payment amount does not match the booking amount".
- Required fix: Use explicit currency and integer minor units from an immutable checkout total; share comparison rules across all verification paths.
- Acceptance criteria: Matching totals pass; under/overpayment, wrong currency/reference, invalid numbers and non-success statuses cannot confirm. Single sessions, packages and multi-session totals agree. Retries neither double-confirm nor duplicate credits/emails; subsequent service price edits do not change the historical total.
- High-level UAT steps: Pay on staging and use Check Paystack; compare callback/webhook/recheck outcomes. Test 19,900 expected versus 199 actual kobo (must fail), valid non-round minor totals, mismatches, grouped checkout and repeated verification.
- UAT evidence required: Redacted provider result, stored total/currency, booking/payment references, check result screenshots and automated negative-case results.
- UAT evidence: Local reproduction only: mismatched 19,900/199 kobo was accepted. Staging evidence pending.
- Status: In Progress
- Notes: [payment-validation.ts](../src/lib/payment-validation.ts) currently guesses units using modulo 100. The reproduction executed locally without contacting Paystack. This is not Ready for UAT until corrected.

### [ ] BK-007 - Repair incomplete booking token flow

- ID: BK-007
- Priority: P0
- Area: Booking, payment and slot integrity
- Client feedback: Fix incomplete booking token flow.
- Required fix: Define secure resume/payment tokens separately from post-confirmation management; handle expiry, replay, completed bookings and stale availability.
- Acceptance criteria: A valid link resumes only its intended booking. Invalid/expired/revoked links expose no client details or booking controls. Opening a link neither reserves time nor confirms payment. Payment success is idempotent even when the browser token expires.
- High-level UAT steps: Open a resume link in another browser; test tampering, expiry, revocation, repeated opens and use after payment. Take its original slot with a paid booking and retry; verify reselection/resolution.
- UAT evidence required: Token-state matrix, redacted screenshots, booking/payment references and callback/replay results; never attach live tokens.
- UAT evidence: Pending; complete resume journey not demonstrated.
- Status: In Progress
- Notes: [booking.functions.ts](../src/lib/booking.functions.ts) has management-token expiry/revocation checks; these alone do not prove incomplete-checkout recovery. Dependencies: BK-004 and NI-001; confirm C5.

### [ ] BK-008 - Allow simultaneous bookings for different therapists

- ID: BK-008
- Priority: P0
- Area: Booking, payment and slot integrity
- Client feedback: Allow two or more therapists to be booked for the same time, whether same or different service.
- Required fix: Preserve therapist identity through slot selection, grouping, allocation, payment confirmation and calendar sync.
- Acceptance criteria: Three available therapists can each receive a confirmed booking at the same time for same/different services. One therapist cannot be double-booked across services or modes; buffers and personal busy periods apply only to that therapist.
- High-level UAT steps: Book therapists A/B/C at the same time for one service, then different services. Attempt an overlapping second booking for A and confirm rejection; add a busy block for A and check B/C remain available.
- UAT evidence required: All booking/payment references, selected therapist IDs, operational calendar screenshots and individual Google event/busy results.
- UAT evidence: Pending; PR #149 is not UAT evidence.
- Status: In Progress
- Notes: [PR #149](https://github.com/enyasystem/talk-space-pro-august/pull/149) remains open. Existing SQL already scopes appointments by therapist. Validate UI identity and confirmation races with BK-004/TA-001.

### [ ] BK-009 - Review bank transfer page

- ID: BK-009
- Priority: P1
- Area: Booking, payment and slot integrity
- Client feedback: Review Bank Transfer page.
- Required fix: Review bank details, amount/reference entry, receipt upload, pending/rejection copy, mobile usability and the admin queue.
- Acceptance criteria: Bank details and total are correct and editable by authorized staff. Reference/receipt persists into review. Pending copy clearly states unconfirmed booking and agreed review timing. Errors allow retry without duplicate submissions.
- High-level UAT steps: Complete the transfer form on mobile and desktop; test missing/invalid input, upload failure and retry. Check persisted details as admin and follow approval/rejection to the client result.
- UAT evidence required: Form/error screenshots, test receipt/reference, saved admin record and approval/rejection messages.
- UAT evidence: Pending; no staging persistence proof linked.
- Status: In Progress
- Notes: [transfer-reference migration](../supabase/migrations/20260912193000_add_payments_transfer_reference.sql) exists; deployment is unverified. Verify the actual RPC arguments and stored reference, not just field presence. Dependencies: BK-005; C4 sets copy/review timing.

## 2. Client records and data management

### [ ] BK-002 - Create/update client records after payment

- ID: BK-002
- Priority: P0
- Area: Client records and data management
- Client feedback: Clients who registered and completed payment should appear on the client record list.
- Required fix: Reconcile successful payments and approved transfers into the correct client record, with retry/recovery for missed writes.
- Acceptance criteria: A registered paying client appears with complete contact details; returning clients update without duplicates; retries are idempotent. Failed sync can be recovered without charging again. Preserve legitimate legacy/imported records.
- High-level UAT steps: Register/pay, repeat as a returning client and approve a transfer. Re-deliver the payment callback and simulate a failed client write followed by retry; check exactly one complete record.
- UAT evidence required: Client-list/detail screenshots, booking/payment references, duplicate-count and sync-recovery results.
- UAT evidence: Pending; no end-to-end record reconciliation evidence linked.
- Status: In Progress
- Notes: ID retained from the former booking group. [payments.functions.ts](../src/lib/payments.functions.ts) skips missing client IDs/incomplete contacts and logs upsert failures. Confirm recovery and guest handling (C6); dependencies CR-001/CR-002.

### [ ] CR-001 - Require complete client contact details

- ID: CR-001
- Priority: P1
- Area: Client records and data management
- Client feedback: No client must be unnamed or without phone and email address.
- Required fix: Apply shared validation to booking, admin creation/edit, import and payment reconciliation; provide a remediation list for existing incomplete records.
- Acceptance criteria: Missing/whitespace names, missing/invalid email and phone fail consistently in UI/server paths. Existing gaps are flagged for correction without inventing contact details or discarding paid bookings.
- High-level UAT steps: Omit each field in every entry path, then submit valid data. Include import rows and an existing incomplete client; correct it and reload.
- UAT evidence required: Validation matrix, invalid-row report, before/after synthetic record screenshots and payment-link preservation.
- UAT evidence: Pending; entry-path gaps remain.
- Status: In Progress
- Notes: Admin update validation exists, but legacy creation allows a nullable phone and import permits incomplete contacts in [clients.functions.ts](../src/lib/clients.functions.ts). Previous Ready for UAT claim covered only part of this requirement.

### [ ] CR-002 - Explain storage and support record upload/download

- ID: CR-002
- Priority: P0
- Area: Client records and data management
- Client feedback: Clarify where client information is stored, and allow upload/download of existing client records.
- Required fix: Document database/file storage and authorized access; complete validated export/import, preview, duplicate handling and error recovery for the agreed record format.
- Acceptance criteria: Admin can export and re-import the agreed fields without loss, including commas, quotes and multiline values. Invalid rows are reported; retries do not duplicate clients or leave partial account records. Non-admins cannot import/export unrelated records.
- High-level UAT steps: Export synthetic clients; import valid, malformed, duplicate and multiline samples. Exercise the agreed update policy and partial-failure retry. Compare field values/counts and test denied access.
- UAT evidence required: Storage/access explanation, synthetic sample/export, field comparison, preview/error/result screenshots and permission checks.
- UAT evidence: Pending; original-workspace UI/status edits remain uncommitted and separate.
- Status: In Progress
- Notes: [clients.functions.ts](../src/lib/clients.functions.ts) already exports/imports CSV, but current parser/validation and skip-existing behavior need completion. C6 must define profile fields versus clinical documents, formats and update policy. Do not publish real client exports as evidence.

## 3. Admin/CMS content updates

### [ ] AC-001 - Edit footer contact address

- ID: AC-001
- Priority: P1
- Area: Admin/CMS content updates
- Client feedback: Enable editing contact address in footer.
- Required fix: Validate the existing footer address editor and persisted public rendering; fix any save/cache/format issues found in UAT.
- Acceptance criteria: Authorized admin edits/saves addresses; reload and public staging footer show the same values without a deployment. Other content/images remain unchanged; multiline text fits mobile.
- High-level UAT steps: Change both office address lines in Admin Settings; save, reload and view multiple public pages on mobile/desktop; restore the test values afterward.
- UAT evidence required: Before/after editor and public screenshots, saved values, viewport and refresh results.
- UAT evidence: Pending; implementation exists, staging acceptance missing.
- Status: Ready for UAT
- Notes: `contactAddress` is present in [admin settings](../src/routes/_authenticated.admin.settings.tsx), settings validation and [SiteFooter.tsx](../src/components/site/SiteFooter.tsx).

### [ ] AC-002 - Remove visible WhatsApp wording from footer

- ID: AC-002
- Priority: P2
- Area: Admin/CMS content updates
- Client feedback: Remove the word "WhatsApp" from footer.
- Required fix: Validate the existing icon/contact-number presentation without the visible word label; retain a working link and accessible name.
- Acceptance criteria: Footer visible contact text has no WhatsApp prefix; icon and number remain usable on desktop/mobile and by keyboard/screen reader.
- High-level UAT steps: Inspect footer on mobile/desktop, tab to the chat link, and open it; confirm the intended number and no layout overlap.
- UAT evidence required: Footer screenshots and chat destination/accessibility check.
- UAT evidence: Pending; no browser sign-off linked.
- Status: Ready for UAT
- Notes: [SiteFooter.tsx](../src/components/site/SiteFooter.tsx) displays icon plus number; the previous "Chat with us" implementation note was inaccurate. WhatsApp remains in accessibility/tooltip labels; assumption is removal of visible prefix, not loss of accessible meaning.

### [ ] AC-003 - Name the Lagos office locator

- ID: AC-003
- Priority: P2
- Area: Admin/CMS content updates
- Client feedback: Second office locator should show as "Talk Space Counseling, Lagos".
- Required fix: Apply the exact supplied label to the second office locator and its relevant CMS-backed text.
- Acceptance criteria: The displayed label is exactly "Talk Space Counseling, Lagos"; map destination remains the Lagos office; the other office and existing images/content are preserved.
- High-level UAT steps: View Contact/office locator on mobile and desktop; inspect second label, reload and follow its map link; verify the first office is unchanged.
- UAT evidence required: Locator/editor screenshots and map destination result.
- UAT evidence: Pending; open PR has no linked staging acceptance.
- Status: In Progress
- Notes: Implemented the exact owner-approved wording in `public/store-locator/locator-plus.html`; the map destination remains unchanged. Both CMS-backed and fallback Contact pages use the same locator. Automated coverage checks locator initialization, office ordering, unchanged Abuja details and the booking link. Staging screenshots remain required. Confirm the external Google configuration address/pin separately before changing it.

## 4. Therapist access and calendar flow

### [ ] TA-001 - Control therapist access and personal calendar connection

- ID: TA-001
- Priority: P0
- Area: Therapist access and calendar flow
- Client feedback: Clarify and control access to Therapist Dashboard.
- Required fix: Complete and document invite/password setup, role/profile linking, scoped data/calendar access, revocation and session recovery.
- Acceptance criteria: Invited new/existing users reach `/therapist` as intended. A therapist sees only assigned committed bookings and manages only their calendar; clients/unlinked users are denied. Admin access needs a separate admin role. Hidden public profiles can retain permitted dashboard access; revoked access cannot. Connected calendars receive committed bookings; unconnected therapists retain the intended email fallback.
- High-level UAT steps: Invite new/existing users; sign in, reload, expire/sign out and retry. Test therapist A against B's booking/calendar actions, a client, unlinked and revoked users. Connect/reconnect/disconnect a test calendar and confirm a booking/busy block; repeat unconnected.
- UAT evidence required: Role/access matrix, onboarding and denial screenshots, sanitized sync/event/email logs and booking references.
- UAT evidence: Pending; no real invitation/OAuth or isolation UAT linked.
- Status: In Progress
- Notes: [therapist.functions.ts](../src/lib/therapist.functions.ts) checks role and linked `user_id`; invite/password routes exist. Resolve C8 for action permissions. Dependencies BK-001/BK-008; use the [therapist checklist](THERAPIST_DASHBOARD_IMPLEMENTATION_CHECKLIST.md) for detailed cases.

## 5. Notifications and incomplete bookings

### [ ] NI-001 - Suppress internal incomplete-booking alerts and remind clients

- ID: NI-001
- Priority: P1
- Area: Notifications and incomplete bookings
- Client feedback: Disable notifications to Talk Space for incomplete bookings; instead notify/remind clients to complete booking.
- Required fix: Gate internal confirmations on commitment and add a bounded client completion-reminder flow linked to secure recovery.
- Acceptance criteria: Incomplete attempts send no internal booking alerts/calendar invitations. Eligible clients receive the agreed reminder with no promise of a held slot. Reminders stop after payment, approval, cancellation or expiry and are deduplicated across retries.
- High-level UAT steps: Abandon checkout and advance the staging reminder schedule; inspect outbound logs and both inboxes. Follow the link, pay, rerun the job, and confirm reminders stop with one committed confirmation. Repeat awaiting transfer review.
- UAT evidence required: Outbound delivery/query logs covering the full reminder window, redacted reminder/confirmation screenshots, booking references and duplicate/stop results.
- UAT evidence: Pending; absence of an inbox message alone is insufficient evidence of suppression.
- Status: In Progress
- Notes: Booking code defers initial checkout confirmations, but [send-reminders](../src/routes/api/public/hooks/send-reminders.ts) is an appointment-reminder flow, not proof of checkout recovery. Dependencies BK-007; C4/C5 define transfer-review exceptions and reminder timing.

## 6. Blog, reviews and public website content

### [ ] PR-001 - Hide public blog tags

- ID: PR-001
- Priority: P2
- Area: Blog, reviews and public website content
- Client feedback: Hide tags on live blog posts.
- Required fix: Validate removal from public article and listing views while preserving CMS metadata.
- Acceptance criteria: Tags are not displayed on public posts/listings on mobile or desktop; title/body/image remain correct and admin tags remain editable.
- High-level UAT steps: Open a tagged post and blog listing as a signed-out visitor; compare mobile/desktop; inspect retained tags in admin.
- UAT evidence required: Public listing/article screenshots and admin metadata screenshot.
- UAT evidence: Pending; source regression test exists, staging proof missing.
- Status: Ready for UAT
- Notes: Public output and [tag visibility test](../test/blog-public-tag-visibility.test.ts) exist. Run the test and browser cases for the staged revision.

### [ ] PR-002 - Complete Google Reviews retrieval, download and updates

- ID: PR-002
- Priority: P1
- Area: Blog, reviews and public website content
- Client feedback: Enable full download/update process for Google Reviews.
- Required fix: Define full sync versus downloadable export; complete authorized retrieval/pagination, stable identity/update handling and admin refresh reporting.
- Acceptance criteria: All reviews available through the agreed source/scope are accounted for, with explicit counts/limits. Repeat sync does not duplicate; edited reviews update; download matches agreed fields. Failed authorization/sync preserves existing published reviews and provides a retry path.
- High-level UAT steps: Sync the designated Google test location; check counts across pages, download and repeat. Test an updated review and provider/auth failure; verify public output and preserved content.
- UAT evidence required: Source/scope decision, sanitized fetch/count logs, export sample, before/after admin/public screenshots and failure/retry result.
- UAT evidence: Pending; external integration not exercised.
- Status: In Progress
- Notes: [admin.functions.ts](../src/lib/admin.functions.ts) has API import, but one-page fetch, text-based merging and 50-row storage limit leave gaps. C9 defines "full" and authorized Google source; do not claim full download from a limited response.

## 7. Mobile performance and image delivery

### [ ] MP-001 - Measure and improve mobile image delivery

- ID: MP-001
- Priority: P1
- Area: Mobile performance and image delivery
- Client feedback: Improve mobile performance through better image delivery.
- Required fix: Establish a repeatable mobile baseline; inspect actual delivered images, responsive variants, compression, cache behavior and loading priority, then optimize the measured bottlenecks.
- Acceptance criteria: Mobile receives correctly sized images without quality/crop regressions; the primary visible image is not delayed by lazy loading; below-fold images load lazily. Approved targets improve over the comparable baseline with no layout regression or broken uploaded/custom URLs.
- High-level UAT steps: Run three comparable cold-load mobile audits before/after on home, pricing, therapists, blog and booking. Compare median metrics/bytes; visually check 360px/390px mobile and desktop, including admin-selected images.
- UAT evidence required: Lighthouse JSON/screenshots, build/device/network conditions, median FCP/LCP/TBT/CLS and image bytes, network captures, visual comparisons.
- UAT evidence: Pending; no new baseline or staging measurement collected.
- Status: Not Started
- Notes: [OptimizedImage.tsx](../src/components/site/OptimizedImage.tsx) and loading priorities exist. Their presence is not measured success. C10 should approve budgets; proposed lab targets: LCP <= 2.5s, FCP <= 1.8s, TBT <= 200ms, CLS <= 0.1. These are proposed acceptance targets, not claimed results.

---

## Summary and implementation order

| Priority | Items |
| -------- | ----: |
| P0       |     9 |
| P1       |     7 |
| P2       |     3 |
| Total    |    19 |

| Status           | Items |
| ---------------- | ----: |
| Not Started      |     1 |
| In Progress      |    15 |
| Ready for UAT    |     3 |
| UAT Passed       |     0 |
| Production Ready |     0 |
| Done             |     0 |

All 19 remain open for release acceptance. This does not mean all require rebuilding: AC-001, AC-002 and PR-001 should start with staging UAT. The other 16 require gap resolution or the new performance assessment before full acceptance testing.

Suggested implementation order once explicitly authorized:

1. BK-006 and BK-004: payment amount integrity and reservation/confirmation races.
2. BK-005/BK-009/BK-007/BK-008: transfer approval, recovery and therapist allocation.
3. BK-002/CR-001/CR-002 and TA-001: complete client records and access boundaries.
4. NI-001 and BK-003 after their product decisions/dependencies; AC-003 and the three Ready for UAT items can proceed independently through their gates.
5. PR-002 and MP-001 with credentials, scope and measured budgets agreed.

## Clarifications before affected implementation

| Decision | Items                | Clarification / proposed interpretation                                                                                                                                                                                             |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1       | BK-001               | Should paid cancelled/no-show sessions remain in a separate history view? Default operations excludes unpaid attempts regardless of status.                                                                                         |
| C2       | BK-003               | Which date/time limits must go: lead time, booking horizon, slot increments, or restriction to available times? Keep real conflicts/past-time protection; do not remove the fields without an explicit request.                     |
| C3       | BK-004/BK-005/BK-007 | When a successful payment arrives after another client has taken the slot, who handles reselection/refund/credit, and what is promised to the client? No double confirmation is allowed.                                            |
| C4       | BK-005/BK-009/NI-001 | Who approves direct transfers, what details/proof and review turnaround are required, and should receipt submissions send an internal review alert? Proposed: separate admin payment-review queue, never a confirmed-booking alert. |
| C5       | BK-007/NI-001        | Which incomplete-link journey is failing? Agree resume-link lifetime, reminder delay/count/channel and eligibility, including pending transfers.                                                                                    |
| C6       | BK-002/CR-002        | Does record upload cover profiles only or also clinical documents/history? Supply the intended fields/format and duplicate-update policy; confirm paid-guest handling. Existing records must be retained.                           |
| C7       | AC-003               | Does "office locator" mean only this site's label or the external Google listing too? Site label is already specified exactly.                                                                                                      |
| C8       | TA-001               | Which booking-management actions may therapists perform themselves? Keep least-required scoped access and personal calendar connection; do not grant general admin access.                                                          |
| C9       | PR-002               | Does "full download" mean Google-to-site sync, a file export, or both? Confirm location(s), authorized source/account and whether every review or a curated display set is required.                                                |
| C10      | MP-001               | Approve representative pages, device/network conditions, metric/image budgets and visual-quality tolerance before optimization.                                                                                                     |

Record each answer here and in affected acceptance criteria before implementing the dependent choice. These decisions do not relax the supplied payment, slot, access, content-preservation or UAT rules.
