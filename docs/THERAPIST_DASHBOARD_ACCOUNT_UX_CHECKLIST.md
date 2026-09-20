# Therapist dashboard account UX checklist

Focused checklist for keeping therapists in a dedicated dashboard instead of exposing the
client account experience or admin console.

## Access and navigation

- [x] Keep therapists out of `/admin` unless they also have the admin role.
- [x] Keep therapists out of the client `/account` experience.
- [x] Send signed-in therapist users from the header account button to `/therapist`.
- [x] Keep the public "Therapist" navigation entry visible for signed-in therapist users.
- [x] Preserve the existing `/login` entry point for therapist sign-in.

## Therapist dashboard UI

- [x] Show therapist profile context on the dashboard.
- [x] Show today and upcoming confirmed sessions in clear dashboard sections.
- [x] Show a calendar status summary card.
- [x] Show a dedicated Google Calendar connection panel.
- [x] Show a clear fallback message when Google Calendar is not connected.
- [x] Let therapists start or refresh their own Google Calendar connection.
- [x] Let therapists open and copy Google Meet links when available.
- [x] Show "Meet link pending" for online sessions without a generated link.

## Data boundaries

- [x] Scope therapist dashboard data to the linked therapist profile.
- [x] Exclude archived appointments.
- [x] Exclude unpaid temporary holds by showing only committed appointment statuses.
- [x] Keep payment management and CMS controls out of the therapist dashboard.

## Verification

- [x] Add tests for therapist account navigation.
- [x] Add tests that therapist users are redirected away from client account UI.
- [x] Add tests for calendar and meeting-link dashboard actions.
- [x] Run automated checks after implementation.
- [ ] Smoke test `/therapist` with a linked therapist user.
- [ ] Smoke test `/account` with a linked therapist user redirects to `/therapist`.
