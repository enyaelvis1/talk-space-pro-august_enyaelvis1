# NI-001: Incomplete booking notifications

Branch: `feature/ni001-notification-gate`.
Implementation complete; **Ready for UAT**, not production approved.
Includes the preceding local BK-007 commit as a dependency. Neither branch has been merged into `develop` or `main` by this implementation.

## What changed

- Single and grouped unpaid holds no longer create admin booking notices. The unpaid paths avoid the notification context/settings lookups as well.
- Package-credit confirmations still notify after the booking is confirmed. Existing payment receipts are preserved; this batch does not add a new card-payment admin notification workflow.
- The shared email sender checks current booking status and archive state before sending booking admin notices, confirmations, reschedule notices, and 24-hour/1-hour session reminders. A queued retry cannot rely on its old payload claiming the booking is confirmed.
- Suppressed attempts are logged as `skipped`, with a reason and retry lineage, without scheduling another retry. The admin failure queue recognizes those resolved retries; historical logs are retained.
- Manual incomplete-booking intake reminders are blocked, even for admins. The shared sender also blocks booking intake retries and old unscoped form-reminder envelopes.
- Scoped, unfinished contact-form reminders remain supported. Legacy unscoped contact reminders must be resent from their intake record rather than replaying the old envelope.
- Scheduled session reminders only select confirmed, unarchived appointments. Manual session reminders reject incomplete bookings. The shared guard checks again before delivery.
- Google event creation already requires confirmed status. Calendar cleanup failure alerts remain visible so cancellation/deletion errors are not hidden.

No new incomplete-checkout reminder schedule, template, resume-link generator, database migration, CMS overwrite, or production data cleanup was added.

## Notification boundaries

There must be **no admin new-booking notice or client completion reminder** for an unpaid hold, abandoned checkout, expired booking, or unapproved transfer.

Payment-success receipts, failed-payment outcome notices, and client acknowledgements of submitted bank-transfer details are transactional messages, not scheduled completion reminders. They remain enabled. Contact messages, password resets, and explicit admin test emails are also unchanged. Genuine provider-delivery errors remain visible in the delivery log; historical rows are not deleted.

The timing/copy decision remains deferred. Before adding completion reminders later, agree the delay, retry limits, recipients, and wording, and implement an active, scoped resume link consistent with BK-007. A generic `/book` link is not proof of a resumable checkout.

## Automated checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

For the inherited BK-007 PostgreSQL tests, use the disposable local container setup described in [BK-007 UAT](BK007_INCOMPLETE_BOOKING_UAT.md). Without `BK007_TEST_POSTGRES_CONTAINER`, that database test is skipped.

New coverage executes the notification policy across incomplete/confirmed/archived/terminal states, missing references, database failures, booking/contact intake records, and stale retry payloads. A separate test loads the real email sender with an isolated database stub and checks that suppression occurs before settings/provider work, records the skip, and does not requeue a blocked retry. No real emails, charges, or production queries are used by these tests.

Local verification (2026-09-13): 198 tests passed with no skips, including the disposable PostgreSQL fixture. TypeScript and production build passed. Lint passed with seven existing Fast Refresh warnings and no errors. The initial suite run hit a Chromium screenshot-capture error in the existing admin-shortcuts browser test; that test passed alone and the complete suite passed on rerun without changing it. External email delivery, Paystack and scheduled-job UAT remain unverified on staging.

## Staging setup

1. Deploy the feature branch to staging after review. Include the BK-007 staging migration and prerequisites; NI-001 adds no migration of its own.
2. Use staging Paystack test keys, a mail sink, and dedicated test clients/therapists. Leave global email and relevant templates enabled so an empty inbox is evidence of the policy, not disabled delivery.
3. Record the test start time and unique client addresses. Capture delivery logs before and after each case. Check the configured Talk Space inbox and client sink, not only the visible bookings list.
4. Run scheduled jobs through the existing authenticated staging scheduler; never expose cron secrets or bearer tokens in screenshots.

## UAT cases

| Case               | Action                                                                                                                                                          | Expected result / evidence                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single hold        | As a guest, reach checkout without paying. Repeat signed in.                                                                                                    | No `booking_admin_notice` or completion reminder. Capture references, start time, staff/client mail sinks and delivery log.                                                                      |
| Group hold         | Select at least two sessions, reach checkout, then abandon it.                                                                                                  | No combined or per-session admin booking notice; no completion reminder. Record all references.                                                                                                  |
| Expiry             | Wait beyond the BK-007 five-minute deadline; run payment recheck, email retry, and session reminder jobs.                                                       | No new-booking notice or completion reminder. Existing payment outcome notices are permitted and must not claim a confirmed session.                                                             |
| Manual reminder    | In admin, attempt a session reminder for an unpaid booking and a form reminder for a booking draft.                                                             | Requests rejected; no provider send and no successful reminder timestamp. Capture the error.                                                                                                     |
| Legacy retry       | In staging, use a failed `booking_admin_notice` template delivery linked to an unpaid/cancelled booking. Run automatic retry and, on another row, manual retry. | Child log is `skipped` with `booking_not_committed`, no new retry date, no mail. Parent no longer appears as an unresolved delivery failure. Old unscoped form-reminder retries are skipped too. |
| Timely payment     | Complete a Paystack test checkout within its deadline.                                                                                                          | Client payment receipt still arrives. This batch does not promise a newly added admin payment notice. Save payment/booking references and receipt.                                               |
| Package credit     | Book using an active paid package link.                                                                                                                         | Confirmed client and admin booking messages still arrive once; no hold-stage message. Save package balance and booking reference.                                                                |
| Confirmed reminder | Use a confirmed, unarchived staging booking within a configured reminder window and run the reminder job.                                                       | Session reminder sends normally. Repeat with an archived record: no reminder.                                                                                                                    |
| Contact control    | Submit the contact form; also send a reminder for an unfinished contact intake.                                                                                 | Existing staff/contact acknowledgements and scoped contact reminder still work. Save delivery evidence.                                                                                          |
| Late payment       | Follow BK-007's late-payment test after expiry.                                                                                                                 | Payment remains recorded with review wording; no false booked-session/admin notice or completion reminder.                                                                                       |

For the legacy-retry case, use synthetic staging fixtures or existing staging test failures only. Do not copy real client retry payloads, decrypt production logs, or deliberately break production email delivery.

## Release gate

- [x] Audit single/group holds, reminders, shared sender, retry processing, and dashboard failure alerts.
- [x] Implement suppression and regression tests without enabling completion reminders.
- [ ] Staging build and UAT cases passed.
- [ ] Attach redacted references, timestamps, delivery logs, and successful control emails to NI-001.
- [ ] Reviewer approves feature PR into `develop` (including BK-007 dependency).
- [ ] Mark UAT Passed / Production Ready, then obtain approval for a separate release PR into `main`.

Future completion-reminder scheduling remains outside this completed suppression batch until timing/copy are approved.
