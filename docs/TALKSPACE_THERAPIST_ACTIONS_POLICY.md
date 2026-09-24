# Talk Space therapist dashboard action policy

Reviewed: 24 September 2026

Until the clinical/product owner approves broader actions, the dashboard uses
the least-privilege default below.

## Allowed by default

- View the signed-in therapist’s own confirmed, completed, and no-show session
  records that are not archived.
- View the minimum client/contact and service details needed for an assigned
  session.
- View/copy an available Google Meet link.
- Connect, reconnect, refresh, and disconnect only the Google Calendar account
  linked to the therapist’s own profile.

## Not allowed by default

- Access `/admin`, payment amounts, payment review actions, CMS, other
  therapists’ appointments, or unrelated client records.
- Change appointment status, reschedule/cancel bookings, edit client records,
  alter service assignment, approve transfers, or resend client email.
- Edit availability or create clinical/session notes until the owner approves
  the policy, retention, audit, and export rules.

## Required approval before expansion

The product/clinical owner must explicitly decide whether therapists may edit
availability, mark completed/no-show/cancelled, see a paid/confirmed state,
read intake answers, or create private session notes. Any approved action must
be added as a therapist-scoped server function, audited without exposing
clinical content, and covered by cross-therapist denial tests.
