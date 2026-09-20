# Booking, payment commitment, and package scheduling checklist

Tracking the September 9 review notes around multi-session purchases, unpaid holds,
admin calendar noise, and when clients should receive booking correspondence.

## Status legend

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked / needs decision

---

## 1. Product rules to confirm

- [x] Decide whether clients can book multiple sessions in one checkout.
      _Question: Should a client buying 10 single sessions be able to select 2 or 3 appointment
      dates before paying once, or should they pay first and receive a booking link/credit balance?_
      _Decision: allow clients to select up to 3 sessions in one checkout, with one grouped payment._
- [x] Decide whether non-expiring bulk sessions are a new product type.
      _Current packages have expiry rules. Some clients want 10 sessions at unit price without
      package expiry restrictions._
      _Decision: admins can issue non-expiring prepaid credits._
- [x] Decide whether bulk prepaid sessions can mix modes.
      _Question: Can one 10-session credit balance be used for both online and in-person, or should
      it remain locked to the mode/service paid for?_
      _Decision: credits stay locked to the selected session mode._
- [x] Decide whether bulk prepaid sessions can mix services.
      _Question: Can a client buy 10 individual sessions and later use some for couple or family
      sessions, or should service matching remain strict?_
      _Decision: credits stay locked to the selected service._

## 2. Booking hold visibility in admin

- [x] Hide unpaid timed holds from the default admin booking calendar.
      _Reason: holds expire quickly and should not fill or block the admin calendar before payment._
- [x] Hide plain Paystack-initiated pending bookings from the default admin booking calendar.
      _Default calendar now shows committed bookings plus pending bookings only when payment is
      succeeded or awaiting bank-transfer confirmation._
- [x] Keep unpaid holds visible only in a separate diagnostic/payment-pending view if needed.
      _Suggested place: admin payments or a filtered "Temporary holds" admin tab._
- [x] Ensure expired holds are cleaned up before calendar counts are calculated.
- [x] Show confirmed/paid appointments by default on `/admin/bookings`.
- [x] Add tests that admin calendar counts exclude unpaid `hold` appointments.

## 3. Client correspondence timing

- [x] Stop sending full session confirmation emails while an appointment is only on hold.
      _Client should not receive a committed session date before payment or package-credit
      confirmation._
- [x] Send payment-started or booking-started copy only if needed.
      _Suggested wording: "Your selected slot is temporarily held while you complete payment."_
      _Decision: do not send an extra pre-payment email now; keep client correspondence tied to
      commitment._
- [x] Send the actual booking confirmation only after payment succeeds or a package credit is
      consumed successfully.
- [x] Ensure online booking confirmation includes the Google Meet link after calendar sync.
- [x] Add tests that hold creation does not trigger the final booking confirmation template.

## 4. Package and bulk-session booking behavior

- [x] Lock website-paid package links to the paid session mode.
- [x] Consume the first paid package booking immediately, leaving 3 of 4 sessions for a 4-session package.
- [x] Prevent extra package bookings when the remaining balance is exhausted.
- [x] Add a non-expiring prepaid credit option for clients buying many single sessions if approved.
- [x] Support booking 2 or 3 sessions at once if approved.
      _Likely implementation: collect multiple slots, create temporary holds for all selected slots,
      initialize one Paystack payment for the combined amount, then confirm all appointments only
      after payment succeeds._
- [x] Add server-side guardrails for multi-slot checkout:
      unique slots, no overlapping therapist times, consistent service/mode rules, max selected
      sessions, and transaction-safe confirmation after payment.
- [x] Add UI that clearly shows selected session count, total amount, and whether credits expire.

## 5. Admin cleanup tools

- [x] Allow admins to permanently delete test bookings from `/admin/bookings` with confirmation.
- [x] Add a safer bulk-clear flow for test data if needed.
      _Suggested guard: require typing `DELETE TEST BOOKINGS`, filter by date/status, and show count
      before deletion._
- [x] Consider a soft-delete/archive option for real production bookings.
      _Permanent delete is useful for tests, but real client records may need audit retention._
      _Implemented: visible bookings now use Archive, while temporary/test cleanup remains
      permanent delete with confirmation._

## 6. Verification plan

- [x] Run automated unit/contract tests.
      _Result: `npm test` passed, 144/144._
- [x] Run lint and production build.
      _Result: `npm run lint` passed with existing Fast Refresh warnings only; `npm run build`
      passed with existing baseline build warnings._
- [x] Verify GitHub, security, and Vercel checks before merging.
      _Result: PR #126 into `develop` and PR #127 into `main` passed checks before merge._
- [x] Apply production Supabase migrations.
      _Result: migrations through `20260909170000_archive_admin_bookings` are applied remotely._
- [x] Smoke-test production URLs.
      _Result: `/`, `/book`, `/admin`, and `/admin/bookings` returned HTTP 200._
- [ ] Test unpaid booking start:
      select a slot, stop before payment, confirm it does not appear in default admin calendar and
      does not send final confirmation email.
- [ ] Test successful Paystack payment:
      confirm appointment appears in admin calendar only after payment succeeds.
- [ ] Test package link:
      confirm package bookings appear only after credit consumption succeeds.
- [ ] Test online Google Meet:
      confirm final email includes meeting link when Google sync succeeds.
- [ ] Test expired hold:
      wait for expiry or run cleanup, then confirm slot becomes available and admin calendar stays
      clean.
- [ ] Test admin deletion:
      delete a test booking and confirm it disappears from calendar counts and day details.
