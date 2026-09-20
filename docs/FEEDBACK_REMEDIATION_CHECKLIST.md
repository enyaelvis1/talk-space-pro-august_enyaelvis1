# Client Feedback Remediation Checklist

Implementation branch: `feature/feedback-remediation`
Base branch: `develop` at `91b0421`

This checklist tracks engineering work needed to close the implementation gaps identified in `TALKSPACE_CLIENT_FEEDBACK_UAT_CHECKLIST.md`. It does not replace staging UAT evidence or release approval.

## Booking and payments

- [x] BK-002: Add reliable recovery for failed payment-to-client-record syncs, including replay handling, incomplete contacts and returning-client deduplication.
- [x] BK-003: Record the approved date/time policy before changing lead time, horizon, increments or timezone validation.
- [x] BK-004: Apply and verify committed-only reservation rules; decide whether active holds and pending payments should remain excluded from availability; define late-payment resolution.
- [x] BK-005: Enforce transfer amount, currency and reference validation; make approval idempotent; handle slot loss and direct/offline payments.
- [x] BK-007: Complete secure incomplete-checkout resume, expiry, revocation, replay and stale-slot recovery, separate from management tokens.
- [ ] BK-008: Complete therapist-specific UI allocation, cross-service conflicts, buffers, busy blocks, calendar sync and concurrent confirmation handling.
- [ ] BK-009: Verify transfer-reference migration/RPC, receipt persistence, mobile retry behavior, review copy and approval/rejection audit flow.

## Client records

- [ ] CR-001: Validate name, email and phone consistently across booking, admin, import and payment paths; add remediation for existing incomplete records.
- [x] CR-002: Repair the merged CSV import runtime path and validate structured multiline/quoted parsing with focused tests.
- [x] CR-002: Complete CSV preview/import/export verification with duplicate/update policy, permission checks, rollback and retry behavior.

## Access and notifications

- [ ] TA-001: Complete invite/recovery/revocation, therapist action scoping, role isolation, OAuth reconnect/disconnect, calendar sync and fallback email behavior.
- [x] NI-001: Verify suppression of incomplete internal alerts and calendar invites; agree and implement bounded client reminders with deduplication and stop conditions.

## Reviews and performance

- [x] PR-002: Add paginated Google Business Profile retrieval and stable provider identity/update handling.
- [x] PR-002: Define and implement the agreed full-export scope, including the limitations of the Places API sample.
- [ ] MP-001: Establish mobile performance baselines and optimize measured image/network bottlenecks with before/after evidence.

## Validation and release

- [ ] Add focused tests for every implementation change and update fixtures as needed.
- [ ] Run formatting, diagnostics, build and the relevant test suites.
- [ ] Run staging UAT for every affected item and attach evidence to the UAT checklist.
- [ ] Commit all implementation work on this branch using Conventional Commits.
- [ ] Push the branch and open/merge the reviewed PR into `develop`.
- [ ] Delete the local and remote feature branch after the merge.

## Completion rule

An item can be checked off here only when its implementation and automated checks are complete. UAT status remains governed by `TALKSPACE_CLIENT_FEEDBACK_UAT_CHECKLIST.md`.
