# Payments review and checkout-expiry fix — 7 October 2026

Branch: `feature/payment-booking-review-integrity`, based on `develop` (`df7b799`).
Status: implemented locally; approved expiry migration blocked by a missing
production prerequisite. No application SQL or production deployment performed.
Related feedback: TS-010, TS-011, TS-015, TS-016 in
[the tracking checklist](TALKSPACE_CLIENT_FEEDBACK_TRACKING_CHECKLIST.md).

## Cause and evidence

- [x] Read-only inspection of the four screenshot references found four archived,
      cancelled bookings with succeeded payments. Three have token revocation
      reason `checkout_expired`; one has an explicit cancellation actor/reason.
      No records, providers, messages or remote SQL were changed.
- [x] The admin mapper omitted `archived_at`, so every paid cancellation was
      repeatedly added to Pending review, even after the booking was archived.
- [x] The token-lifecycle trigger silently changed `confirmed` to `cancelled`
      after the five-minute checkout deadline, even with a succeeded payment.
      The payment RPC could therefore report success without review metadata.
- [x] The cleanup function also expired submitted bank transfers while awaiting
      admin approval. Later availability migrations reintroduced unpaid holds
      and pending transfers into slot blocking.
- [x] The old retry RPC used metadata alone to detect a failed booking and
      could downgrade succeeded money when that metadata requested review.
- [x] The isolated PostgreSQL regression test reproduced the original defect
      before applying the new migration, then verified the corrected behavior.

## Implemented safeguards

- [x] Exclude archived bookings from active Pending review; retain every payment
      in Archived bookings, Confirmed and All with neutral, accurate history.
- [x] Explicitly explain that archiving neither confirms a session nor refunds
      money. Unarchiving returns unresolved payments to active review.
- [x] Derive booking review from current payment/appointment state, so stale
      metadata does not label a confirmed/completed booking or refund as unresolved.
- [x] Offer Restore only for future, unarchived, paid cancelled bank bookings.
      Offer rescheduling to both providers for active unresolved bookings.
- [x] Keep financial history protected; reject attempts to reset paid/refunded
      payments to unpaid/failed on the server as well as disabling the UI selector.
- [x] Show bank-approval success only when the booking actually confirmed.
- [x] Prepare transactional migration
      `20261007100000_fix_paid_booking_expiry_review.sql`:
      verified money bypasses only unpaid checkout expiry, not contact/slot guards;
      transfer submissions survive review without reserving a slot;
      auto-expired future bookings can revalidate and commit on verified payment;
      intentional cancellations and archives never auto-revive;
      group commitment rolls back in full on conflict;
      duplicate success preserves the original verification/token state;
      legacy unarchived paid cancellations receive the metadata needed by the
      existing admin reschedule RPC; resolved flags clear; rescheduling restores
      a valid manage token. Only confirmed, unarchived bookings reserve slots.
- [x] Keep listing to the existing single payment query; no polling or additional
      provider requests were introduced.

## Database approval and rollout gate

- [x] User approved proceeding with the prepared expiry fix. Read-only preflight
      identified the linked project as production `vwupdobwjlmitsgasdrz`, matching
      the screenshot project. Approval is not treated as permission to apply
      other pending migrations.
- [ ] Verify the target migration history contains the existing commitment,
      token lifecycle, grouped payment, paid-review retry, admin reschedule,
      confirmed-contact/payment integrity and archive/availability migrations.
- [ ] Confirm a recoverable backup, capture preflight counts and old definitions
      of `mark_payment_status`, `apply_appointment_manage_token_lifecycle`,
      `expire_stale_holds` and `list_available_slots`, and name a rollback owner.
      Keep dumps, contact data and credentials outside Git.
- [ ] Pause payment rechecks/booking writes for the approved application window.
- [ ] Apply the single new migration last, in timestamp order. Its function and
      metadata changes run in one transaction. Stop on any SQL error; do not
      repair/delete migration history or use a blanket push of unknown migrations.
- [ ] Compare pre/post appointment and payment counts, financial statuses and
      values, service-role RPC grants, archive states, and unchanged CMS records.
- [ ] Complete the synthetic UAT below before a feature PR to `develop` and a
      separately approved release PR to `main`. No production deployment performed.

Rollback: a failure before COMMIT rolls back the migration. For a failure after
COMMIT, pause writes and use the named operator's approved snapshot recovery or
forward fix. Do not blindly restore old functions alone after payment commitment:
newly confirmed slots, renewed tokens and metadata must be reconciled with the
financial ledger. This migration deliberately does not delete payments or
automatically repair historical bookings during application.

### Approved application attempt — preflight stopped before SQL changes

- [x] Read the linked migration history and fetched a private copy, without
      repairing, reverting or deleting history. Its latest version is
      `20260922180000_admin_site_backups`, a genuine remote-only migration that
      must be preserved rather than marked reverted to unblock `db push`.
- [x] Captured a protected schema-only snapshot outside Git (223,782 bytes,
      SHA-256 `2309456f99ae8302d04bbe89d8a786a36f1ba08ff03ee2c88d1c09a6fcdee493`).
      It preserves the old function definitions, but is **not** a complete,
      recoverable data backup. Private location supplied only to the operator.
- [x] Checked Supabase backup availability: no managed backups are listed and
      PITR is disabled. A verified data backup and rollback owner are still needed.
- [x] Verified the dumped schema lacks both
      `appointments_confirmed_contact_guard` and
      `payments_succeeded_integrity_guard`, including their guard functions.
      The confirmed-slot guard, token lifecycle, expiry, payment status and
      reschedule functions exist; missing contact/payment guards are the blocker.
- [x] Added a transactional fail-fast prerequisite check to the expiry migration
      and regression coverage for absent/disabled guards. It refuses application
      before function replacement or metadata changes.
- [ ] Obtain specific approval for prerequisite
      `20260924120000_client_feedback_booking_payment_guards.sql`, then the expiry
      fix. Review that prerequisite's bank-transfer amount/contact validation,
      complete backup/rollback readiness, and reconcile the remote-only backup
      migration in a temporary application workspace without changing history.
- [ ] Apply `20260924120000` before `20261007100000`, only after the above approval
      and gates. Do not blanket-push the other pending migrations:
      `20260924121000`, `20260924130000`, `20260925120000`.

No remote booking, payment or CMS records were changed during this attempt.
No Paystack, mail, WhatsApp, SMS or Calendar delivery was invoked. The original
checkout and current browser server remain unchanged; the archived-review UI fix
is still on the feature branch and requires the normal PR/UAT/release workflow.

## User UAT

Use disposable local/staging accounts, synthetic contact details, Paystack test
references and an email/calendar sink. Live provider delivery remains untested.

| Case                            | Expected result                                                                                                                  | Reference / evidence                                      | Status                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| Archived paid cancellation      | Absent from Pending review after refresh; remains under Archived/Confirmed/All; neutral cancelled-history label, unchanged money | Synthetic `TEST-ARCHIVED`; admin-mapper unit fixture      | Automated passed; browser UAT pending  |
| Active paid cancellation        | Remains in Pending; both providers offer reschedule; no past/archived Restore action                                             | `TEST-CANCEL`; isolated DB and state tests                | Automated passed; browser UAT pending  |
| Paid after five-minute deadline | Valid future slot confirms instead of silently cancelling; usable manage link                                                    | `TEST-DELAYED`, `TEST-EXPIRED`; isolated DB               | Automated passed; sandbox UAT pending  |
| Delayed bank approval           | Transfer remains pending without blocking slot; admin approval confirms exactly once                                             | `TEST-BANK`; isolated DB                                  | Automated passed; browser UAT pending  |
| Bank rejection                  | Payment fails; unpaid booking expires; slot remains available                                                                    | `TEST-REJECT`; isolated DB                                | Automated passed; browser UAT pending  |
| Real slot conflict              | Money stays succeeded; booking remains unconfirmed and actively reviewable                                                       | `TEST-GROUP`, `TEST-GROUP-2`; isolated DB                 | Automated passed; browser UAT pending  |
| Retry and concurrency           | No duplicate commitment or verification/token rewrite; one booking per therapist instant; other therapist unaffected             | `TEST-LEGACY`, `TEST-RACE-A/B`, `TEST-OTHER`; isolated DB | Automated passed; provider UAT pending |
| Resolve by rescheduling         | Same paid appointment confirms at new slot, warning clears, new active manage token                                              | `TEST-CANCEL`; actual admin reschedule RPC in isolated DB | Automated passed; browser UAT pending  |

## Validation results

- [x] Full local suite with `SKIP_EGRESS_BROWSER=1 PLAYWRIGHT_AUTH_UAT=0`:
      333 cases, 329 passed, 4 skipped, 0 failures (61 test files).
- [x] Lint: no errors; 7 existing Fast Refresh warnings.
- [x] Production build: passed locally, not deployed.
- [ ] Full TypeScript check: blocked by the same 5 pre-existing missing
      notification-RPC typings on unchanged `develop`; no new diagnostic in the fix.
- [x] Final diff/format check passed; changes committed on the feature branch.
- [x] Application-readiness follow-up: 41 focused payment/expiry tests passed;
      the isolated database cases verify absent/disabled prerequisite guards
      abort before function, metadata or financial state changes.
- [ ] Credentialed admin browser/sandbox/provider UAT; never claim these passed
      from mocked tests or the read-only production diagnostic.

The current port-8080 server and its existing checkout were intentionally left
unchanged. This feature worktree does not contain the still-unmerged PR #75
package/calendar changes; the releases must be coordinated through `develop`.
