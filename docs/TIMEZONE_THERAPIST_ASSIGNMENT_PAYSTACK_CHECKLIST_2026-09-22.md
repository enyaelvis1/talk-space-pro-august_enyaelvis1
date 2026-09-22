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

## Implementation evidence — Milestones 1–2

- Shared WAT formatting is implemented in `src/lib/time.ts` using
  `Africa/Lagos`; storage and provider payloads continue to use ISO/UTC-safe
  timestamps.
- Client detail now loads active therapists, exposes an assignment selector,
  confirms changes, and sends the selection through the protected admin server
  mutation.
- The server rejects inactive or unknown therapist assignments.
- Migration `20260922120000_audit_client_assignment_changes.sql` adds client
  profile/assignment changes to the existing audit trigger without copying
  client values into audit records.
- Existing appointment rescheduling remains the path for moving one booking;
  its RPC validates WAT slot boundaries, therapist availability, conflicts, and
  appointment state.
- Focused tests: 25 passing. TypeScript, lint, production build, and diff
  checks passed. Build output retains existing deprecation/chunk warnings.

## Milestone 1 — Establish the time and environment baseline

- [x] Record the current feature branch, local commit, environment policy, and
      measurement date without recording secrets. Deployed build and live
      environment still require staging access.
- [x] Confirm the product time policy: timestamps remain UTC-compatible in
      storage, while booking and operational times display and validate in
      `Africa/Lagos` / WAT through the shared time helper.
- [x] Confirm WAT formatting for the audited booking, availability, therapist,
      client, payment, message, email, Google, CMS, preview, audit, and
      step-up surfaces. Remaining non-time numeric `toLocaleString` calls are
      not date formatting.
- [x] Test the UTC/WAT boundary around midnight and confirm Lagos remains UTC+1
      without daylight-saving adjustment in the shared formatter tests.
- [ ] Capture redacted examples of the affected booking, availability rule,
      and Paystack payment row; omit names, email addresses, tokens, and raw
      provider secrets from committed evidence.

## Milestone 2 — Therapist assignment and reassignment

- [x] Audit the current client assignment and appointment therapist fields,
      server functions, database constraints, and admin UI.
- [x] Admins can change the client’s default therapist from the protected client
      detail editor; the server requires an active therapist or explicit
      unassignment.
- [x] Define separate behavior: default assignment changes do not move existing
      appointments; a specific future/confirmed appointment uses Edit booking
      and the availability-validated reschedule RPC.
- [x] Require explicit confirmation for default therapist changes, showing the
      client, new therapist, and that existing appointments are unchanged.
- [x] Re-check the new appointment therapist’s service eligibility, mode,
      availability, buffers, busy calendar, and conflict state through the
      existing reschedule availability query.
- [x] Prevent reassignment of completed or cancelled appointments; the existing
      RPC rejects those states.
- [x] Preserve the audit trail, payment ownership, booking reference, manage
      link, intake data, and notification history. Client assignment changes
      now have an immutable audit trigger; appointment changes retain the
      existing appointment audit and notification flow.
- [x] Define notification behavior: default assignment changes do not notify
      because they do not alter a booked session; appointment rescheduling uses
      the existing idempotent lifecycle notices.
- [x] Add authorization, active-therapist validation, conflict, state, timezone,
      audit, and reschedule contract tests. Live concurrent UAT remains pending.

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

- [x] Create an implementation branch from `develop` using the project naming
      convention.
- [x] Implement and test on the feature branch.
- [ ] Open a pull request to `develop` and complete staging/UAT.
- [ ] After approval, open the separate release pull request from `develop` to
      `main`; never merge the feature branch directly into `main`.
