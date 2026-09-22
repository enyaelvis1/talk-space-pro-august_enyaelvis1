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
      archived records. The archived recovery view and restore action are now
      complete; lifecycle labeling and payment-action safeguards remain.
- [x] Milestone 3a: add the on-demand archived booking recovery view and safe
      restore action.
- [x] Milestone 3b: protect financial history from payment deletion and make
      eligible versus protected payment actions explicit in the admin UI.
- [x] Milestone 3c: expose explicit payment and booking lifecycle labels so
      pending review, verified booking, verified payment needing review,
      cancelled, refunded, and archived states are not conflated.
- [x] Milestone 3d: classify high-risk booking and payment changes with
      explicit immutable audit actions visible in Admin → Audit.
- [x] Milestone 3e: make eligible unpaid/test deletion explicit, reasoned, and
      separate from archive in the admin bookings UI.
- [x] Milestone 3f: make Paystack admin verification failures actionable and
      distinguish provider, checkout, amount/currency/reference, and booking
      review outcomes.
- [x] Milestone 3g: harden lifecycle cleanup and payment reconciliation so
      eligible unpaid/test deletion is transactional and successful-payment
      side effects remain claim/idempotence protected.
- [x] Milestone 3h: make slot replacement an explicit operator decision and
      keep replacement/rescheduling guarded by the transactional booking RPCs.
- [x] Milestone 3i: make identical committed reschedule retries return the
      existing appointment without a second slot change or notification.
- [x] Milestone 3j: add atomic lifecycle-notification claims for client
      reschedule and cancellation notices, with stale-claim retry handling.
- [x] Milestone 3k: move archive/restore into admin-only transactional RPCs,
      coalesce concurrent Google syncs, and add lifecycle request-safety tests.
- [x] Milestone 3l: add claim-protected therapist notices for reschedules and
      cancellations, with explicit email templates/settings and slot-lifecycle
      regression coverage.
- [x] Milestone 3m: re-apply the admin booking RPC after detecting remote
      migration drift, qualifying its service, therapist, client, package, and
      appointment `id` references.

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
- [x] Trace the admin verification path from `Check Paystack` through the
      server function, provider lookup, grouped checkout validation, and
      payment/appointment reconciliation. The path is covered by the handler
      contract tests and server-side phase boundaries.
- [x] Make already-succeeded and already-refunded transactions idempotent:
      checking them again must return the stored result instead of throwing.
- [x] Return actionable admin errors for missing references, provider
      failures, amount/currency mismatches, stale checkout groups, and payment
      records that need rescheduling or refund review. Raw provider errors and
      payloads are logged server-side only; the UI receives safe guidance.
- [x] Ensure a successful Paystack check creates or refreshes the booking link,
      client record, meeting-link state, and confirmation notifications exactly
      once. Client/Google reconciliation is rerunnable, while payment and
      therapist/customer/admin notifications use database claim markers.
- [x] Add regression tests for first verification, repeated verification,
      provider timeout, mismatched amount, and paid-booking review states.

## Confirmed versus pending-review records

- [x] Define separate lifecycle labels for payment review, confirmed booking,
      cancelled booking, refunded payment, and archived record in the admin
      payment and booking views.
- [x] Ensure deleting or resolving a pending-review payment cannot remove a
      confirmed appointment or its audit history. Financial payment deletion
      remains status-protected, and booking cleanup is database-guarded.
- [x] Replace destructive row actions with explicit labels and confirmation
      dialogs that show the booking reference, payment state, and consequences.
- [x] Add an audit event for every verify, resolve, archive, restore, cancel,
      delete, refund, and slot-release action. The lifecycle migration keeps
      the existing single audit trigger and assigns explicit action names.
- [x] Add a recovery/admin view for accidentally archived or removed records;
      never rely on the UI list as the only record of a payment. The admin
      bookings page loads archived records on demand and restores them without
      deleting payment or booking history.

## Safe booking deletion and cancellation

- [x] Add a clearly labelled `Delete booking` action separate from `Archive`.
- [x] Restrict permanent deletion to authorized administrators and require a
      typed confirmation plus a server-validated cleanup reason.
- [x] Block permanent deletion by default for paid, refunded, completed, or
      legally/audit-relevant payment records; provide review, cancel, refund,
      or archive workflows instead.
- [x] If deletion is approved for an unpaid booking, revoke its manage token,
      clear holds, remove it from availability, and record the audit event. The
      new admin-only RPC performs the checks and cleanup in one transaction.
- [x] For paid bookings, preserve the payment ledger and client history even if
      the appointment is cancelled or hidden from active views.
- [ ] Confirm archive, cancellation, deletion, and restore behavior in the
      admin bookings, payments, calendar, client, reminder, and email views.

## Slot replacement and rescheduling

- [x] Add a `Release slot` or `Cancel and release` workflow distinct from
      permanent deletion.
- [x] Require the operator to choose: reschedule the same client, cancel with
      refund review, or release the slot for a new booking. The admin UI now
      presents these three distinct decisions before mutating the booking.
- [x] Prevent a new booking from occupying the slot until the original
      appointment state and payment consequence are committed transactionally.
      The locked reschedule/cancel RPCs roll back on unavailable replacement
      slots.
- [x] Preserve the original time, therapist, service, payment, and reason in
      the appointment timeline when a slot is released or replaced. Existing
      timeline/audit fields retain the original appointment and decision reason.
- [x] Revoke or regenerate manage and Meet links according to the resulting
      state; do not leave an old client link active after reassignment.
- [x] Send the correct client and therapist notifications exactly once after a
      reschedule, cancellation, refund decision, or replacement. Client notices
      and new therapist lifecycle notices use appointment-scoped atomic claims;
      replacement releases use the cancellation path and new bookings use the
      claimed therapist booking notice.
- [x] Add regression coverage for same-time multi-therapist identity, paid and
      unpaid lifecycle states, archived/recovery boundaries, and competing
      replacement safety contracts. Staging concurrency still requires UAT.

## Database, permissions, and request safety

- [x] Add/adjust transactional RPCs and migrations for verify, cancel, delete,
      restore, release-slot, and replacement operations. Archive and restore
      now use admin-only RPCs; verify, cancel, delete, release, and replacement
      already use guarded transactional RPCs.
- [x] Qualify every ambiguous `id`, status, and appointment/payment reference
      in SQL joins and RPC return clauses for the active lifecycle RPCs. Older
      superseded migrations remain immutable historical records.
- [x] Enforce admin authorization server-side for all destructive and payment
      actions; do not trust client-visible status or IDs alone.
- [x] Make retries idempotent and prevent duplicate emails, Meet operations,
      payment updates, and audit events. Payment confirmation is already
      idempotent; lifecycle client notices use atomic claims; repeated
      reschedules are no-ops; and concurrent Google syncs are coalesced.
- [x] Confirm the changes do not add polling or duplicate Supabase requests to
      payments, bookings, calendar, or confirmation pages. The admin booking
      clock is local-only, Google polling is visibility-gated, and request
      contracts cover the payment/booking/confirmation surfaces.

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
