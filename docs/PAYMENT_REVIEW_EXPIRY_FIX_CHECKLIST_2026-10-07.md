# Payments review and checkout-expiry fix — 7 October 2026

Branch: `feature/payment-booking-review-integrity`, based on `develop` (`df7b799`).
Status: both specifically approved database migrations applied and independently
verified on production `vwupdobwjlmitsgasdrz` on 7 October 2026, after a complete
protected logical backup, two isolated restore checks and migration rehearsal.
The database rollout did not push, merge or deploy the application/UI changes.
On 7 October the user reported UAT complete and approved pushing this feature,
merging it into `develop`, then a separate `develop` → `main` release PR.
Independent browser/provider evidence capture remains pending.
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
- [x] Verify the target migration history contains the existing commitment,
      token lifecycle, grouped payment, paid-review retry, admin reschedule,
      and archive/availability behavior. Add the missing confirmed-contact/payment
      integrity prerequisite before the expiry fix, under the specific approval.
- [x] Confirm a recoverable backup, capture preflight counts and old definitions
      of `mark_payment_status`, `apply_appointment_manage_token_lifecycle`,
      `expire_stale_holds` and `list_available_slots`, and name a rollback owner.
      Keep dumps, contact data and credentials outside Git.
- [x] Serialize affected public-table writes inside the approved transaction
      using ordered `SHARE ROW EXCLUSIVE` locks and bounded lock/statement
      timeouts. No remote app/provider shutdown was performed.
- [x] Apply only `20260924120000`, then `20261007100000`, in one transaction.
      Stop on any SQL error; do not
      repair/delete migration history or use a blanket push of unknown migrations.
- [x] Compare pre/post appointment and payment counts, financial statuses and
      values, service-role RPC grants, archive states, and unchanged CMS records.
- [x] Receive the user's UAT-complete sign-off and explicit approval for the
      feature PR to `develop`, followed by a separate release PR to `main`.
      Required CI checks still gate both merges; do not bypass failing checks.

Rollback owner: Enyasystem, with the execution operator assisting only after
approval of the exact recovery target/action. A failure before COMMIT rolls back
the transaction. For a failure after COMMIT, pause writes and use approved recovery or
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
- [x] Obtain specific approval for prerequisite
      `20260924120000_client_feedback_booking_payment_guards.sql`, then the expiry
      fix. Review that prerequisite's bank-transfer amount/contact validation,
      complete backup/rollback readiness, and reconcile the remote-only backup
      migration in a temporary application workspace without changing history.
- [x] Apply `20260924120000` before `20261007100000`, only after the above approval
      and gates. Do not blanket-push the other pending migrations:
      `20260924121000`, `20260924130000`, `20260925120000`.

No remote booking, payment or CMS records were changed during this initial attempt.
No Paystack, mail, WhatsApp, SMS or Calendar delivery was invoked. The original
checkout and current browser server remain unchanged; the archived-review UI fix
is still on the feature branch and requires the normal PR/UAT/release workflow.

### Complete backup and approved application — 7 October 2026

- [x] Complete protected logical backup: 82 tables, 24,639 rows, database roles
      without infrastructure login passwords, sequence positions and migration
      history. Auth identities/password hashes, client records, appointments,
      payment history, 4,851 CMS revisions and stored encrypted credentials/vault
      ciphertext are included. All 1,143 actual Storage files were downloaded
      and encrypted (164,146,685 bytes), not just their database metadata.
- [x] Every encrypted artifact passed AES-256-GCM authentication and plaintext/
      encrypted SHA-256 verification. Backup directories are private (0700),
      artifacts are 0600, and the matching key is stored separately, never in Git.
- [x] Two network-isolated PostgreSQL 17 restore checks passed, including the
      saved reusable recovery helper. All 82 source table counts and row
      fingerprints matched. Canonical columns, constraints, triggers, functions,
      effective grants and RLS policies matched; no restored database was exposed
      to an application, and cron/network delivery was disabled.
- [x] Exact rollout transaction rehearsed against the restored backup at
      `2026-10-07T13:27:00.714Z`; production application completed and independently
      verified at `2026-10-07T13:31:09.143Z` (14:31 WAT).
- [x] Applied only `20260924120000_client_feedback_booking_payment_guards.sql`
      and `20261007100000_fix_paid_booking_expiry_review.sql`. Normal new history
      entries were added (154 → 156); every previous history row, including
      remote-only `20260922180000_admin_site_backups`, was preserved. The other
      pending migrations were not applied, repaired or marked reverted.
- [x] In-transaction assertions preserved all original public records: 163
      appointments, 37 payments and 51 clients, including financial values/statuses,
      archive states and CMS records. Only approved payment review metadata and
      update timestamps changed; existing audit rows were preserved and exactly
      one legitimate audit event per changed payment was allowed.
- [x] Independent post-COMMIT checks confirmed both migrations, enabled contact/
      payment triggers, service-role-only payment RPC execution and function
      definitions identical to rehearsal. No historical booking was revived,
      payment deleted or live provider request made.

Evidence is stored outside Git in the private
[backup manifest](/home/enyasystem/.local/share/talkspace-backups/2026-10-07-pre-payment-migrations-gyrE59/MANIFEST.json),
alongside `RESTORE_README.md`, `MIGRATION_REHEARSAL.json`,
`MIGRATION_APPLICATION.json` and the reusable offline restore helper.
Exact rollout SQL SHA-256:
`66fc44643e3217c74bc3d0c29040b7a0fd527a975e1ed3e2e0b7462ea1a41f12`.

This is not physical/PITR recovery. External project encryption root keys,
infrastructure login passwords, `.env`, deployment/control-plane configuration
and external provider resources are not included. Vault ciphertext may need the
original project root key. Storage/sequence capture is separate from the table
snapshot, not an atomic snapshot of simultaneous uploads/deletions. Preserve
protected off-device copies of archives and key separately; no off-device upload
was performed. Database application does not publish the pending UI fix or
resolve intentional historical cancellations; synthetic browser/provider UAT
and the normal feature → develop → approved main release remain required.

### User UAT sign-off and release approval — 7 October 2026

- [x] User reported “UAT is done” and authorized push/merge to `develop` and
      `main`, then requested completion after the interrupted release check.
- [x] Re-ran the 41 focused payment/expiry regression tests: 41 passed, none
      failed or skipped. Lint passed with the same seven baseline Fast Refresh
      warnings; `git diff --check` passed.
- [ ] Push the exact feature commit and merge its green PR into `develop`.
- [ ] Verify the integration checks, then merge a separate approved
      `develop` → `main` PR. No feature → `main` merge, force push or history rewrite.

Sign-off is user-reported acceptance of this payment-review/expiry feature, not
an independently observed execution of every historical audit scenario. No
case-level screenshots or new sandbox references were supplied; existing UAT
table entries below retain their evidence limitations. Do not fabricate those
artifacts or claim live provider tests were run. Open package/calendar PRs and
unrelated dependency/backup PRs are outside this release scope.

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
