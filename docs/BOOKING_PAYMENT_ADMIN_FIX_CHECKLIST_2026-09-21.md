# Booking and payment admin fix checklist — 2026-09-21

Purpose: resolve the Paystack confirmation failure, prevent accidental loss of
confirmed records, add safe booking deletion, and support controlled slot
replacement.

## Progress — 2026-09-21

- [x] Milestone 1: make admin Paystack rechecks idempotent.
- [x] Milestone 2: add admin cancellation that releases a confirmed slot while
      preserving paid booking and payment history.
- [ ] Milestone 3: add recoverable archive/delete actions and explicit lifecycle
      separation for pending review, confirmed, cancelled, refunded, and
      archived records. Server-side archived-list and restore primitives are
      now in place; the admin recovery view and lifecycle UI remain.

## Incident safety and evidence

- [ ] Record the affected booking ID, booking reference, payment ID, Paystack
      reference, service, therapist, session time, and current appointment and
      payment statuses.
- [ ] Capture the exact `Check Paystack` error, HTTP status, server log event,
      and request correlation ID.
- [ ] Redact customer names, phone numbers, email addresses, tokens, payment
      payloads, and secrets from committed evidence.
- [ ] Do not delete, refund, reschedule, or replace the affected booking until
      its payment and appointment state are backed up and reviewed.

## Paystack confirmation failure

- [ ] Reproduce the failure with a test payment or a redacted provider
      reference; do not repeatedly verify a live customer payment.
- [ ] Trace the admin verification path from `Check Paystack` through the
      server function, provider lookup, grouped checkout validation, and
      payment/appointment reconciliation.
- [x] Make already-succeeded and already-refunded transactions idempotent:
      checking them again must return the stored result instead of throwing.
- [ ] Return actionable admin errors for missing references, provider
      failures, amount/currency mismatches, stale checkout groups, and payment
      records that need rescheduling or refund review.
- [ ] Ensure a successful Paystack check creates or refreshes the booking link,
      client record, meeting-link state, and confirmation notifications exactly
      once.
- [x] Add regression tests for first verification, repeated verification,
      provider timeout, mismatched amount, and paid-booking review states.

## Confirmed versus pending-review records

- [ ] Define separate lifecycle states for payment review, confirmed booking,
      cancelled booking, refunded payment, and archived record.
- [ ] Ensure deleting or resolving a pending-review payment cannot remove a
      confirmed appointment or its audit history.
- [ ] Replace destructive row actions with explicit labels and confirmation
      dialogs that show the booking reference, payment state, and consequences.
- [ ] Add an audit event for every verify, resolve, archive, restore, cancel,
      delete, refund, and slot-release action.
- [ ] Add a recovery/admin view for accidentally archived or removed records;
      never rely on the UI list as the only record of a payment.

## Safe booking deletion and cancellation

- [ ] Add a clearly labelled `Delete booking` action separate from `Archive`.
- [ ] Restrict permanent deletion to authorized administrators and require a
      typed or selected reason plus confirmation.
- [ ] Block permanent deletion by default for paid, refunded, completed, or
      legally/audit-relevant bookings; provide `Cancel`, `Refund review`, or
      `Archive` instead.
- [ ] If deletion is approved for an unpaid booking, revoke its manage token,
      clear holds, remove it from availability, and record the audit event.
- [x] For paid bookings, preserve the payment ledger and client history even if
      the appointment is cancelled or hidden from active views.
- [ ] Confirm archive, cancellation, deletion, and restore behavior in the
      admin bookings, payments, calendar, client, reminder, and email views.

## Slot replacement and rescheduling

- [x] Add a `Release slot` or `Cancel and release` workflow distinct from
      permanent deletion.
- [ ] Require the operator to choose: reschedule the same client, cancel with
      refund review, or release the slot for a new booking.
- [ ] Prevent a new booking from occupying the slot until the original
      appointment state and payment consequence are committed transactionally.
- [ ] Preserve the original time, therapist, service, payment, and reason in
      the appointment timeline when a slot is released or replaced.
- [x] Revoke or regenerate manage and Meet links according to the resulting
      state; do not leave an old client link active after reassignment.
- [ ] Send the correct client and therapist notifications exactly once after a
      reschedule, cancellation, refund decision, or replacement.
- [ ] Test same-time multi-therapist slots, paid bookings, unpaid holds,
      archived bookings, and competing replacement requests.

## Database, permissions, and request safety

- [ ] Add/adjust transactional RPCs and migrations for verify, cancel, delete,
      restore, release-slot, and replacement operations.
- [ ] Qualify every ambiguous `id`, status, and appointment/payment reference
      in SQL joins and RPC return clauses.
- [x] Enforce admin authorization server-side for all destructive and payment
      actions; do not trust client-visible status or IDs alone.
- [ ] Make retries idempotent and prevent duplicate emails, Meet operations,
      payment updates, and audit events.
- [ ] Confirm the changes do not add polling or duplicate Supabase requests to
      payments, bookings, calendar, or confirmation pages.

## Verification and release

- [x] Run targeted payment, booking-state, permission, notification, and
      request-budget tests.
- [x] Run the full CI suite, lint, type-check, and production build for the
      completed milestones; repeat after the next lifecycle milestone.
- [ ] Perform staging UAT for Paystack verification, pending-review resolution,
      confirmed-booking protection, deletion, slot release, and replacement.
- [ ] Verify the affected live record through the approved recovery workflow;
      do not edit production data manually from the browser or SQL console.
- [ ] Merge feature branch to `develop`, deploy and verify staging, then open
      the approved release PR from `develop` to `main`.
- [ ] Monitor payment errors, booking-link generation, cancellations, and
      Supabase request volume after release.

## Acceptance criteria

- Rechecking a successful Paystack transaction is safe and produces a clear
  result without duplicate booking or notification work.
- Confirmed bookings cannot be accidentally removed by pending-review actions.
- Administrators can cancel, archive, delete eligible unpaid records, and
  release a slot with an auditable reason.
- A paid booking can only be replaced through an explicit reschedule,
  cancellation/refund-review, or transfer workflow.
- Payment and booking history remain recoverable after every administrative
  action.
