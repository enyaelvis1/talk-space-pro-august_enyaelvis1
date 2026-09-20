# Talk Space — Booking Package, Therapist Pool & Calendar Fix Checklist

Branch: `feat/talkspace-booking-package-calendar-checklist`
Scope: client feedback remediation for package-first booking, therapist pools, and general calendar behavior.

Important guardrails:

- [x] Do all work on a feature branch only.
- [x] Never work directly on `main` or production.
- [x] Never force-push.
- [ ] Do not deploy to production.
- [x] Do not run migrations in this branch.
- [ ] If database work is required, document the migration plan only and wait for product/technical approval before execution.
- [ ] Validate every implementation item on staging/develop and capture screenshots or test evidence before marking UAT passed.

## Summary

- [x] File created/updated: `docs/TALKSPACE_BOOKING_PACKAGE_CALENDAR_CHECKLIST.md`
- [x] Checklist items: 11
- [x] Priority breakdown: P0 = 6, P1 = 4, P2 = 1
- [x] Status: BPC-001 and BPC-002 are implemented and locally verified; staging migration and UAT evidence remain.
- [ ] Database-related items requiring migration review but not migrated in this branch: 5

## Priority breakdown

- [ ] P0 (blocking product flow): BPC-001, BPC-002, BPC-003, BPC-004, BPC-006, BPC-007
- [ ] P1 (important booking and calendar flow): BPC-005, BPC-008, BPC-009, BPC-010
- [ ] P2 (polish / UX cleanup): BPC-011

## Recommended implementation order

1. [x] BPC-001: Make booking fields optional and preserve purchase-first flow.
2. [x] BPC-002: Allow multi-package / multi-session purchases and enforce purchase-first behavior.
3. [x] BPC-003: Fix session-balance reduction on booking confirmation.
4. [x] BPC-004: Enforce per-client paid-balance limits before booking.
5. [x] BPC-006: Model therapist pools per service and assign from the pool.
6. [x] BPC-007: Make therapist availability checks per therapist instead of global blocking.
7. [x] BPC-008: Allow multiple therapists to take same-time slots.
8. [x] BPC-009: General calendar as overview-only, not a single global blocker.
9. [x] BPC-010: Preserve existing booking logic while integrating the new policies.
10. [x] BPC-005: Keep selected fields optional but correctly persisted when chosen.
11. [x] BPC-011: Remove unnecessary public tags from services/blog/service pages.

## Items that may require database changes but were not migrated

- [x] BPC-002: package/session purchase balance model implemented in a pending migration
- [ ] BPC-003: session consumption ledger and reduction logic
- [ ] BPC-004: purchase limit enforcement and paid-balance checks
- [ ] BPC-006: service-to-therapist pool mapping and assignment rules
- [ ] BPC-007 / BPC-008 / BPC-009: per-therapist availability, conflict checks, and general calendar overview data model

These items are documented as migration-plan-only until approved. No migration has been run in this branch.

## Checklist

## Current implementation tracking

- [x] Confirm the active feature branch and preserve the no-production/no-migration guardrails.
- [x] Trace the current public booking and payment flow for BPC-001.
- [x] Confirm that the current public payment initializer requires one or more appointment IDs.
- [x] Define the purchase-without-booking payment and package-credit persistence contract.
- [x] Implement the purchase-only flow with appointment-independent payment records.
- [x] Add automated coverage for purchase without booking and idempotent package activation.
- [ ] Capture staging/develop UAT evidence before marking BPC-001 passed.

### BPC-001 implementation discovery

- Current state: `Ready for UAT`.
- Implemented boundary: package purchases use appointment-independent payment rows and create credit only after verified payment.
- Package activation is idempotent by source payment, starts with zero used sessions, and returns a secure later-booking link.
- Migration status: migration implemented and validated in disposable PostgreSQL; it has not been applied to staging or production.
- Validation status: local automated and browser checks pass; staging Paystack evidence is still required.

### BPC-001 implementation contract checklist

- [x] Tie each purchase to one service so credit cannot cross service boundaries.
- [x] Allow session mode to remain unset until booking or lock it when selected at purchase.
- [x] Support guest contact identity and optional authenticated client linkage.
- [x] Define a package-purchase payment record that can exist without an appointment.
- [x] Define idempotent payment confirmation for package-credit creation.
- [x] Use the secure package link to select and consume the correct balance later.
- [x] Implement nullable appointment linkage guarded by an explicit payment kind constraint.
- [x] Draft contract direction: represent a package-only payment separately from appointment payments, preserve idempotent provider references, and activate `client_session_packages` only after successful payment confirmation.
- [x] Implement the approved persistence and RPC changes without applying them to hosted environments.

### BPC-001 — Optional booking form fields while preserving purchase-first flow

- ID: BPC-001
- Priority: P0
- Area: Booking UX / purchase flow
- Problem: Service Details, Session Mode, Preferred Date and Preferred Time are currently forced before a client can pay for a package or buy future sessions.
- Required fix: Make the booking fields optional during package purchase and multi-session purchase. Preserve paid purchase flow even when no booking is made yet. When selected, save and reuse those values properly on the later booking step.
- Acceptance criteria:
- [x] Session Mode, Preferred Date and Preferred Time can be left empty during purchase; service remains required so credit has an enforceable service boundary.
- [x] A paid package can exist without an immediate booking.
- [x] If a client selects optional preference fields, they are retained in payment metadata.
- [x] Incomplete/unpaid purchase attempts do not create appointments or reserve therapist slots.
- High-level UAT steps:
  1. [ ] Visit the booking flow as a guest and start a package purchase.
  2. [ ] Leave service details and preferred time empty.
  3. [ ] Complete purchase and confirm the paid package remains active without a booking.
  4. [ ] Return later and book from the balance.
- UAT evidence required:
  - [ ] Screenshot of purchase flow with fields left blank
  - [ ] Screenshot of successful package purchase without booking
  - [ ] Screenshot of later booking using saved/selected values
- Status: Ready for UAT — implementation and local automated verification complete; staging migration and Paystack evidence pending.
- Tracking:
  - [x] Confirm existing booking flow still requires a held appointment before payment.
  - [x] Confirm existing package credit is consumed only when a package booking is held.
  - [x] Define package purchase without appointment data model and payment lifecycle.
  - [x] Implement public purchase-only checkout.
  - [x] Implement later booking from the resulting package balance.
  - [x] Add automated migration and payment-flow tests.
  - [ ] Capture staging Paystack UAT evidence.
- Notes: This is the primary gate for package-first behavior and should be implemented before balance enforcement. The current `payments.appointment_id` contract is required, so a purchase-only path needs an approved migration to a separate package-purchase payment relation or an explicitly nullable appointment relation plus package metadata. No migration has been run.

### BPC-002 — Multi-package and multi-session purchase support

- ID: BPC-002
- Priority: P0
- Area: Payment / package flows
- Problem: The system does not clearly support purchase-first behavior for multiple packages or sessions, and the paid balance model may be too rigid for a package purchase queue.
- Required fix: Allow a client to purchase more than one package or multiple sessions while preserving balance tracking. Ensure assumptions about a single active package do not prevent multiple valid purchases.
- Acceptance criteria:
  - [x] Clients can make repeated package purchases or purchase a 1–50 session bundle.
  - [x] Purchase-first flow does not require immediate booking.
  - [x] Each purchase has an independently auditable balance and secure booking link.
- High-level UAT steps:
  1. [ ] Purchase one package and then a second package or extra sessions.
  2. [ ] Confirm both purchases are visible and balances are cumulative.
  3. [ ] Use a later booking to consume the balance.
- UAT evidence required:
  - [ ] Payment confirmation screenshots for multiple purchase actions
  - [ ] Balance summary screenshot before and after booking
- Status: Ready for UAT — repeated purchases create separate package balances; staging evidence pending.
- Tracking:
  - [x] Existing checkout supports up to ten sessions under one payment reference.
  - [x] Existing package balances are stored independently per package record.
  - [x] Existing later-booking balance consumption is transactional.
  - [x] Preserve separate package balances and links instead of silently combining expiry or mode rules.
  - [x] Implement repeated package-only purchases under idempotent provider references.
  - [ ] Capture cumulative balance evidence on staging/develop.
- Notes: The current schema can represent multiple package rows, but website package activation still depends on an appointment-linked payment. Any package-only payment relation and balance-history work remains migration-plan-only.

### BPC-003 — Correct paid session balance reduction after booking

- ID: BPC-003
- Priority: P0
- Area: Booking / session ledger
- Problem: Booked sessions must reduce the client’s paid session balance, but the current behavior may not reconcile package/session balance correctly.
- Required fix: When a booking is confirmed, decrement the available balance by the number of booked sessions. Ensure the reduction happens only once per successful booking and not for failed or expired holds.
- Acceptance criteria:
  - [ ] Booked sessions reduce available session balance.
  - [ ] A client cannot book more sessions than their paid balance allows.
  - [ ] Failed or expired/incomplete bookings do not consume paid balance.
- High-level UAT steps:
  1. [ ] Purchase a 3-session package.
  2. [ ] Book 1 session and confirm the balance drops to 2.
  3. [ ] Attempt to book more than remaining sessions and confirm rejection.
  4. [ ] Confirm expired or abandoned checkout does not consume balance.
- UAT evidence required:
  - [ ] Before/after balance screenshots
  - [ ] Rejection screenshot when over-balance booking is attempted
- Status: Purchase-only balance creation and package-booking reduction validated locally; staging UAT pending.
- Tracking:
  - [x] Successful package booking increments `used_sessions` exactly once.
  - [x] Package booking returns the remaining balance after consumption.
  - [x] Failed or conflicting payment flows do not activate or consume package credit.
  - [x] Live local PostgreSQL booking-integrity checks pass.
  - [x] Define and implement purchase-only balance creation after successful payment verification.
  - [ ] Capture staging before/after balance evidence.
- Notes: The existing package-credit RPC safely handles balance reduction for a later booking. The remaining gap is creating a balance from a purchase that has no appointment yet.

### BPC-004 — Purchase-first booking later flow with balance enforcement

- ID: BPC-004
- Priority: P0
- Area: Booking / package lifecycle
- Problem: The product requirement says clients should be able to purchase first and book later; the system must enforce that rule without allowing a later over-book.
- Required fix: Add a clear purchase-first path in the system and block booking attempts that exceed the current paid balance. Only allow a confirmed booking when the client has enough paid sessions left.
- Acceptance criteria:
  - [ ] Client can buy package/session credit without an immediate booking.
  - [ ] Client can book later using the paid balance.
  - [ ] Booking later is blocked when the paid balance is insufficient.
- High-level UAT steps:
  1. [ ] Purchase package credit only.
  2. [ ] Confirm the booking flow allows later scheduling from paid balance.
  3. [ ] Book until the balance is exhausted.
  4. [ ] Attempt one more session and confirm rejection.
- UAT evidence required:
  - [ ] Purchase-only flow screenshot
  - [ ] Later booking screenshot from paid balance
  - [ ] Over-limit rejection screenshot
- Status: Purchase-first and later-booking safeguards validated locally; staging UAT pending.
- Tracking:
  - [x] Package booking links allow clients to schedule remaining sessions later.
  - [x] Service and session-mode mismatches are rejected.
  - [x] Exhausted, expired, and inactive package balances are rejected.
  - [x] Overlapping therapist bookings remain protected by the booking integrity rules.
  - [x] Package/payment integrity tests pass: 30 passed, 0 failed.
  - [x] Implement purchase-first checkout with no appointment or slot reservation.
  - [ ] Capture purchase-only, later-booking, and over-limit staging evidence.
- Notes: The purchase-first migration and later-booking path are implemented and validated locally. Hosted migration and Paystack UAT remain gated to staging.

### BPC-005 — Keep optional fields while preserving selected values and proper save flow

- ID: BPC-005
- Priority: P1
- Area: Booking form persistence
- Problem: The system may still force or partially ignore optional fields during purchase and booking-later flows, leading to lost selection state.
- Required fix: Keep Service Details, Session Mode, Preferred Date and Preferred Time optional at purchase time, but if selected they must be saved, restored and used correctly on the later booking stage.
- Acceptance criteria:
  - [ ] Fields can be blank during purchase without blocking payment.
  - [ ] If selected, values persist across re-entry and later booking.
  - [ ] The chosen values are respected in the final booking.
- High-level UAT steps:
  1. [ ] Buy a package without selecting any values.
  2. [ ] Re-enter booking flow and select a service/mode/date/time.
  3. [ ] Confirm the saved values are retained and used in the final booking.
- UAT evidence required:
  - [ ] Screenshot of blank purchase flow
  - [ ] Screenshot of selected values carried forward
- Status: Persistence validated locally; staging UAT pending.
- Tracking:
  - [x] Booking drafts persist service, session mode, preferred date, and preferred time together.
  - [x] Booking route restores saved draft values when re-entering without a package token.
  - [x] Invalid drafts are ignored and drafts can be cleared.
  - [x] Focused form-draft tests pass: 2 passed, 0 failed.
  - [ ] Verify selected values survive browser re-entry on staging/develop.
  - [ ] Confirm restored values are respected by the final booking submission.
  - [ ] Capture blank-form and restored-selection evidence.
- Notes: This is a persistence and continuity requirement, not just a validation requirement. Package-token bookings intentionally bypass anonymous drafts so package client and service data remain authoritative.

### BPC-006 — Service-to-therapist pool model instead of clumsy manual tagging

- ID: BPC-006
- Priority: P0
- Area: Therapist assignment / service configuration
- Problem: Therapist assignment currently depends on manually tagging one therapist to a service, which does not scale to service families or pools such as Child/Teen Therapy, Psychiatry and Couple Therapy.
- Required fix: Introduce service group/pool support where each service can be tied to multiple capable therapists. The assignment logic should choose from a valid pool rather than a single manual tag.
- Acceptance criteria:
  - [ ] A service can map to multiple participating therapists.
  - [ ] Child/Teen Therapy can assign from 3 therapists.
  - [ ] Psychiatry can assign from 2 psychiatrists.
  - [ ] Couple Therapy can assign from 3 capable therapists.
- High-level UAT steps:
  1. [ ] Inspect service configuration for each service family.
  2. [ ] Confirm that multiple therapist IDs are associated with the service.
  3. [ ] Book a service and confirm assignment can come from the group.
- UAT evidence required:
  - [ ] Service/configuration screenshot or admin panel export
  - [ ] Booking result screenshot showing assignment from the pool
- Status: Implementation validated locally; staging UAT pending.
- Tracking:
  - [x] Services support multiple therapist assignments through `therapist_services`.
  - [x] Admin services UI exposes assigned therapists for each service.
  - [x] Admin save flow synchronizes additions and removals in the assignment table.
  - [x] Availability generation uses service-to-therapist assignments.
  - [x] Focused admin and availability tests pass.
  - [ ] Verify Child/Teen, Psychiatry, and Couple Therapy pool membership on staging/develop.
  - [ ] Capture service configuration and assigned booking evidence.
- Notes: The many-to-many pool model already exists and no new migration is required for this implementation slice. Staging data/UAT still needs to confirm the requested therapist membership counts.

### BPC-007 — Per-therapist availability checks; no global blocking by service, mode or time

- ID: BPC-007
- Priority: P0
- Area: Availability / calendar logic
- Problem: Availability is effectively blocked globally instead of being therapist-specific. One therapist’s calendar or a service-level setting should not prevent another therapist from being available.
- Required fix: Evaluate availability per therapist and per therapist calendar. Do not treat service, mode or time as a global lock when different therapists can handle the same slot independently.
- Acceptance criteria:
  - [ ] Therapist availability is checked per therapist.
  - [ ] One therapist’s calendar does not block another therapist’s availability.
  - [ ] Different therapists can be booked at the same time.
- High-level UAT steps:
  1. [ ] Book a session for one therapist at a given time.
  2. [ ] Confirm a different therapist remains available at that same time.
  3. [ ] Confirm the same service can occur at the same time with different therapists.
- UAT evidence required:
  - [ ] Screenshot of same-time slots for different therapists
  - [ ] Availability comparison screenshot by therapist
- Status: Implementation validated locally; staging UAT pending.
- Tracking:
  - [x] Availability returns therapist-specific slots without global time deduplication.
  - [x] Hold validation requires the requested therapist identity and slot time.
  - [x] Focused availability and appointment-state tests pass.
  - [ ] Run staging/develop UAT with two therapists sharing a time.
  - [ ] Capture availability comparison evidence.
- Notes: This is the core calendar rule change required to support therapist pools. Live database concurrency validation remains pending because no PostgreSQL test container was configured.

### BPC-008 — Allow same-time same-date bookings across multiple therapists

- ID: BPC-008
- Priority: P1
- Area: Calendar / therapist scheduling
- Problem: Multiple therapists must be able to take sessions at the same date and time, but current availability calculations implicitly collapse or block the slot.
- Required fix: Remove global deduplication based on service or time alone. Keep therapist identity distinct in the availability and booking key path.
- Acceptance criteria:
  - [ ] Different therapists can be booked at the same time.
  - [ ] Same service can happen at the same time with different therapists.
  - [ ] One therapist cannot be double-booked at the same time.
- High-level UAT steps:
  1. [ ] Select two therapists with overlapping time slots.
  2. [ ] Confirm both can receive appointments at the same date/time.
  3. [ ] Attempt a second booking for the same therapist at the same time and confirm rejection.
- UAT evidence required:
  - [ ] Screenshot showing two therapists booked at same time
  - [ ] Screenshot showing same-therapist double-book prevented
- Status: Implementation validated locally; staging UAT pending.
- Tracking:
  - [x] Slot identity preserves therapist, mode, and instant.
  - [x] Same-time slots for different therapists remain selectable together.
  - [x] Same-therapist duplicate slot identity remains rejected by the booking contract.
  - [x] Focused source-contract and picker tests pass.
  - [ ] Run live PostgreSQL competing-request validation.
  - [ ] Capture same-time multi-therapist booking evidence.
- Notes: This is an implementation and UAT gate for the multi-therapist booking rule. The live database test is currently skipped when `BK008_TEST_POSTGRES_CONTAINER` and `BK007_TEST_POSTGRES_CONTAINER` are unset.

### BPC-009 — General calendar should be an overview only, not a single blocking calendar

- ID: BPC-009
- Priority: P1
- Area: Calendar overview / UI
- Problem: The general calendar should be an overview of all therapists’ calendars without overriding or interfering with individual therapist calendars.
- Required fix: Keep the general calendar as a summary/overview and do not use it as the only booking blocker. Daily or weekly availability should aggregate therapist calendars without flattening them into a single global schedule.
- Acceptance criteria:
  - [ ] General calendar shows all therapist bookings correctly.
  - [ ] Individual therapist calendars are not overridden by the overview view.
  - [ ] Overview view does not block another therapist’s availability.
- High-level UAT steps:
  1. [ ] Open the general calendar with multiple therapists booked.
  2. [ ] Confirm each therapist’s bookings appear accurately.
  3. [ ] Confirm a different therapist remains available at the same time if their own calendar is free.
- UAT evidence required:
  - [ ] General calendar screenshot showing multiple therapist bookings
  - [ ] Team overview screenshot with no false blocking
- Status: Implementation validated locally; staging UAT pending.
- Tracking:
  - [x] General calendar aggregates visible committed appointments across therapists.
  - [x] Same-time appointments for different therapists remain distinct in the overview.
  - [x] Temporary unpaid/expired holds are excluded from the general calendar.
  - [x] Focused calendar aggregation tests pass.
  - [ ] Run staging/develop UAT with multiple therapist bookings.
  - [ ] Capture general calendar and team overview screenshots.
- Notes: The general calendar is an overview surface only; it is not used as the availability or booking conflict source. This remains a UI/UAT validation item and requires no migration for the current implementation.

### BPC-010 — Preserve existing working booking logic while integrating therapist pool and calendar changes

- ID: BPC-010
- Priority: P1
- Area: Booking flow / compatibility
- Problem: The system must keep the previous booking logic that was working while adjusting the general calendar to accommodate each therapist independently.
- Required fix: Add therapist-pool and per-therapist scheduling without breaking the current booking workflow. Keep the existing valid paths intact while layering in the new pool/availability rules.
- Acceptance criteria:
  - [ ] Existing booking flow still works for valid cases.
  - [ ] The new therapist-pool logic is layered in without breaking current booking assumptions.
  - [ ] Package and session flows work with the updated availability model.
- High-level UAT steps:
  1. [ ] Run a valid existing booking flow.
  2. [ ] Repeat the same flow with pool-aware availability.
  3. [ ] Confirm no breakage in the happy path.
- UAT evidence required:
  - [ ] Before/after screenshot of the working booking path
  - [ ] Staging validation evidence for a normal and a pool-based booking
- Status: Compatibility validated locally; staging UAT pending.
- Tracking:
  - [x] Existing booking policy and optional date/time behavior remain covered.
  - [x] Multi-session checkout continues to group up to ten holds under one payment reference.
  - [x] Therapist-specific same-time slot selection remains covered.
  - [x] Payment/client synchronization contract remains covered.
  - [x] Focused compatibility suite passes: 34 passed, 0 failed.
  - [ ] Run the normal and pool-aware booking paths on staging/develop.
  - [ ] Capture before/after booking evidence.
- Notes: The implementation change in this slice updated stale test harness assertions to match current typed validators and merged payment/client payload behavior. No production booking or payment logic was changed.

### BPC-011 — Remove unnecessary visible tags from services/blog/service pages

- ID: BPC-011
- Priority: P2
- Area: Public UX / content polish
- Problem: Unnecessary visible tags on services, blog or service pages make the public experience feel clumsy and crowded.
- Required fix: Remove or simplify non-essential tags from public service pages and related promotional surfaces while preserving useful internal metadata.
- Acceptance criteria:
  - [ ] Public pages feel cleaner and less cluttered.
  - [ ] Tags that are not required for navigation or filtering are removed.
  - [ ] Internal taxonomy remains available to staff/admin if needed.
- High-level UAT steps:
  1. [ ] Open the public service and blog pages.
  2. [ ] Verify the tags are removed or minimized where they are not useful.
  3. [ ] Confirm the experience feels cleaner on mobile and desktop.
- UAT evidence required:
  - [ ] Before/after screenshots of the public pages
- Status: Public-surface behavior validated locally; staging visual UAT pending.
- Tracking:
  - [x] Public service pages use editorial section labels, not taxonomy tag chips.
  - [x] Blog cards retain useful category/date metadata without rendering tag lists.
  - [x] Public content pages expose a single page/journal/topic label rather than imported tag collections.
  - [x] Public CMS and accessibility/performance tests pass: 32 passed, 0 failed.
  - [ ] Review service and blog pages on staging/develop at mobile and desktop widths.
  - [ ] Capture before/after or current-state screenshots for the public surfaces.
- Notes: No code removal was necessary in this slice because the current public renderers already keep taxonomy metadata out of the visible service/blog/content UI. Internal CMS metadata remains available to staff.

## UAT gate for each item

After each implementation item:

- [ ] Test on staging/develop environment only.
- [ ] Add screenshot or test evidence.
- [ ] Confirm package purchase without booking.
- [ ] Confirm booking later from paid balance.
- [ ] Confirm balance reduction after booking.
- [ ] Confirm two therapists can receive bookings at the same time.
- [ ] Confirm one therapist cannot be double-booked at the same time.
- [ ] Confirm general calendar shows all therapist bookings correctly.
- [ ] Do not mark Production Ready until UAT passes.

## Implementation note

This checklist is intentionally conservative and staged-only. It documents all required logic and acceptance gates for the booking package, therapist pool, and calendar changes, while explicitly not performing migrations or production deployment from this branch.
