# Timezone, Therapist Assignment, Availability, and Paystack Checklist — 22 September 2026

This checklist captures the current operational issues before implementation.
Use synthetic clients and Paystack test transactions for verification. Do not
store real client details, payment references, tokens, or credentials here.

## Issue summary

- Admin and client-facing times must be consistently displayed in West Africa
  Time (WAT), using the canonical IANA zone `Africa/Lagos`.
- Admins need a safe way to assign or change a therapist for a client and to
  define whether that change affects future appointments, an individual
  appointment, or both.
- Tunbi Olabisi appears to have repeated daily availability at the same
  displayed time. The source rule, timezone conversion, duration, buffers, and
  UI grouping must be checked before deleting or recreating availability.
- Paystack verification returned HTTP 400 with `transaction_not_found`.
  This must be diagnosed against the exact environment, provider mode, and
  transaction reference rather than retried blindly.

## Milestone 1 — Establish the time and environment baseline

- [ ] Record the current branch, commit, deployed build, environment, and
      measurement date without recording secrets.
- [ ] Confirm the product time policy: store timestamps in UTC, display and
      validate booking times in `Africa/Lagos` / WAT, and document any client
      timezone conversion explicitly.
- [ ] Confirm WAT formatting for booking cards, availability grids, emails,
      payment records, reminders, calendar events, audit logs, and exports.
- [ ] Test the UTC/WAT boundary around midnight and confirm there is no daylight
      saving adjustment for Lagos.
- [ ] Capture redacted examples of the affected booking, availability rule,
      and Paystack payment row; omit names, email addresses, tokens, and raw
      provider secrets from committed evidence.

## Milestone 2 — Therapist assignment and reassignment

- [ ] Audit the current client assignment and appointment therapist fields,
      server functions, database constraints, and admin UI.
- [ ] Confirm whether an admin can change the assigned therapist today; if the
      control exists, verify it saves through an authorized server mutation.
- [ ] Define separate behavior for changing a client’s default therapist,
      changing one future appointment, and changing a confirmed appointment.
- [ ] Require an explicit confirmation showing the affected client,
      appointment(s), old therapist, new therapist, date/time in WAT, and reason.
- [ ] Re-check the new therapist’s service eligibility, mode, availability,
      buffers, busy calendar, and conflict state before saving.
- [ ] Prevent reassignment of a completed or cancelled appointment unless an
      authorized recovery workflow is used.
- [ ] Preserve the audit trail, payment ownership, booking reference, manage
      link, intake data, and notification history during reassignment.
- [ ] Define notification behavior for the client, old therapist, and new
      therapist; make retries idempotent and avoid duplicate messages.
- [ ] Add authorization, validation, conflict, rollback, and concurrent-update
      tests for therapist reassignment.

## Milestone 3 — Duplicate Tunbi availability investigation and fix

- [ ] Query the affected therapist’s active recurring rules and exceptions,
      grouped by weekday, local start/end time, timezone, service, mode,
      duration, buffer, and source record ID.
- [ ] Compare the database rows with the admin availability UI and the public
      booking slot response; identify whether the duplicate is data, timezone
      conversion, date formatting, or UI key/grouping behavior.
- [ ] Confirm that two different therapists can share an instant while the
      same therapist cannot receive duplicate slots for the same instant.
- [ ] Confirm availability is generated in `Africa/Lagos` and converted to UTC
      only for storage/comparison, with no double conversion on display.
- [ ] Add a unique/idempotent rule or migration safeguard for duplicate
      therapist/time definitions where the business rule permits it.
- [ ] Do not delete the affected availability row until its source, linked
      bookings, exceptions, and audit history are identified.
- [ ] Verify 10:30 and all other daily slots across daylight-independent WAT,
      booking duration, buffer, service, and session mode combinations.
- [ ] Add regression tests for repeated daily slots, duplicate UI keys,
      multiple therapists at one instant, and concurrent booking attempts.

## Milestone 4 — Paystack verification error

- [ ] Capture only the redacted payment provider, environment, currency,
      amount, payment status, and reference fingerprint/last characters.
- [ ] Confirm the reference sent to Paystack is the provider transaction
      reference, not the internal payment ID, booking reference, access code,
      email, or a client-generated value.
- [ ] Confirm the admin and checkout are using the same Paystack environment
      (test versus live), key pair, merchant account, and API base URL.
- [ ] Confirm the transaction was created successfully before verification and
      that the admin is not checking a stale, truncated, or replaced reference.
- [ ] Make the verification action show a clear distinction between not found,
      pending, failed, successful, wrong-environment, and already-verified.
- [ ] Keep verification server-side; never expose Paystack secret keys or trust
      client-supplied amount, currency, status, or booking ownership.
- [ ] Make repeated verification idempotent: it must not duplicate payment
      rows, confirmations, booking links, emails, or audit events.
- [ ] Add safe retry/backoff only for transient provider failures; do not retry
      `transaction_not_found` without correcting the reference or environment.
- [ ] Test a real Paystack sandbox transaction, callback, webhook, and admin
      “Check Paystack” action with matching test credentials.
- [ ] Verify that a successful Paystack payment creates or restores the booking
      link and preserves the correct booking/payment relationship.

## Milestone 5 — UI and operational UAT

- [ ] Admin can view and edit all relevant times in WAT with no duplicate
      labels or ambiguous dates.
- [ ] Admin can assign a therapist to a client and see the saved therapist after
      reload, with authorization and audit evidence.
- [ ] Admin can reassign an eligible future appointment without releasing or
      double-booking the wrong slot.
- [ ] Tunbi’s availability shows each valid slot once and still respects
      duration, buffer, service, mode, and calendar conflicts.
- [ ] A valid Paystack test payment verifies successfully and produces the
      expected confirmed status, booking/manage link, and notifications.
- [ ] An invalid or wrong-environment reference produces an actionable error
      without changing payment or booking state.
- [ ] Repeat the checks with one visible tab, one hidden tab, two tabs, a page
      reload, and a slow network profile.
- [ ] Record remaining provider, staging, calendar, email, and migration
      limitations before promotion.

## Promotion path

- [ ] Create an implementation branch from `develop` using the project naming
      convention.
- [ ] Implement and test on the feature branch.
- [ ] Open a pull request to `develop` and complete staging/UAT.
- [ ] After approval, open the separate release pull request from `develop` to
      `main`; never merge the feature branch directly into `main`.
