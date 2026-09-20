# Admin Booking And Messages Checklist

## Scope

- Add a first-class admin workflow for creating bookings.
- Move contact-form conversations into a dedicated Admin > Messages area.
- Keep email configuration and delivery logs in Admin > Emails.

## Admin-created booking

### Product decisions

- [ ] Confirm whether an admin-created booking is a hold, confirmed booking, or payment-pending booking by default.
- [ ] Confirm whether the admin may mark payment as bank transfer, Paystack, package credit, or unpaid.
- [ ] Confirm whether payment confirmation is required before reserving the therapist slot.
- [ ] Confirm whether the admin can create one session or a grouped multi-session booking.
- [ ] Confirm the notification recipients and templates for an admin-created booking.

### Server and data model

- [x] Add an admin-only server function with schema validation for client, service, mode, date/time, therapist, notes, and payment option.
- [x] Reuse the existing availability and conflict checks used by public booking holds.
- [x] Reuse the existing booking-reference, manage-token, client-profile, payment, and package-credit rules.
- [x] Ensure physical bookings store the physical location and do not create a Google Meet link.
- [x] Ensure online bookings create or queue Google Calendar/Meet synchronisation only when the payment and booking state allow it.
- [ ] Keep the operation auditable with actor, payment option, status, and source metadata.
- [ ] Add server-side authorization tests preventing non-admin creation.

### Admin interface

- [x] Add a `Create booking` action to Admin > Upcoming bookings.
- [x] Add client selection with an option to create a client record when needed.
- [x] Add service, session mode, therapist, date, available time, notes, and payment fields.
- [x] Show the exact total, payment state, booking state, and availability result before submission.
- [x] Disable submission while the request is in progress and show actionable validation errors.
- [x] Show the new booking reference and return to booking operations after creation.

### Verification and release

- [ ] Test online and physical bookings.
- [ ] Test therapist conflict and Google busy-block conflict handling.
- [ ] Test bank transfer, Paystack, package credit, unpaid, and multi-session paths.
- [ ] Test email delivery and physical-address wording.
- [ ] Run TypeScript, lint, unit tests, build, and authenticated browser UAT.
- [ ] Apply any required Supabase migration through the normal migration process.
- [ ] Open a feature PR to `develop`, complete UAT, then use a separate approved release PR to `main`.

## Admin messages

- [x] Add a dedicated Admin > Messages route for contact-form submissions.
- [x] Keep the existing protected server-side list and delete actions.
- [x] Add refresh, sender contact details, message content, delivery state, and delete controls.
- [x] Link the dashboard message shortcut to Admin > Messages.
- [x] Keep Admin > Emails focused on provider settings, templates, reminders, and delivery logs.
- [ ] Confirm whether messages need an explicit read/replied status and reply tracking in a future batch.
