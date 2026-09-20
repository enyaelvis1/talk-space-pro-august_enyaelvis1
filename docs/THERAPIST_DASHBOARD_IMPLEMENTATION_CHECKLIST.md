# Therapist dashboard implementation checklist

Tracking the work needed to give therapists a private dashboard without exposing admin-only
operations, payments, CMS, or other therapists' client records.

## Status legend

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked / needs decision

---

## 1. Product and access decisions

- [ ] Confirm whether therapists should use the existing `/login` page or a dedicated
      `/therapist/login` entry point.
- [ ] Confirm the dashboard URL.
      _Suggested: `/therapist` or `/therapist/dashboard`._
- [ ] Confirm which therapist records are allowed:
      assigned appointments only, assigned clients only, or all clients they have ever seen.
- [ ] Confirm whether therapists can edit availability themselves or only admins can edit it.
- [ ] Confirm whether therapists can mark sessions as completed, no-show, or cancelled.
- [ ] Confirm whether therapists can see payment status.
      _Recommended: no payment amounts; at most "confirmed/paid" session commitment state._

## 2. Roles and permissions

- [ ] Add or confirm a `therapist` app role in Supabase role tables/policies.
- [ ] Create helper access checks similar to admin guards, but scoped to therapist role.
- [ ] Link authenticated users to therapist profiles.
      _Suggested: add `therapists.user_id` or a separate therapist-user mapping table._
- [ ] Ensure admins can assign or invite a therapist user from `/admin/therapists`.
- [ ] Ensure a therapist cannot access `/admin` unless they also have the admin role.
- [ ] Add route guards for every therapist dashboard route.

## 3. Dashboard routes and navigation

- [ ] Add authenticated therapist shell/navigation.
- [ ] Add therapist dashboard overview.
      _Suggested cards: today's sessions, upcoming sessions, pending follow-ups._
- [ ] Add therapist appointments page.
      _Suggested filters: today, upcoming, completed, cancelled._
- [ ] Add appointment detail page.
      _Include only permitted client/contact/session data._
- [ ] Add therapist profile page for viewing their public profile details.
- [ ] Add a clear sign-out path that clears stale session UI state.

## 4. Therapist appointment data

- [ ] Build server functions for therapist appointment listing.
- [ ] Filter appointment queries by the signed-in therapist's profile id.
- [ ] Include session date/time, mode, service, client name, booking reference, and Meet link.
- [ ] Include Google Meet link only when available and relevant for online sessions.
- [ ] Exclude archived bookings from therapist views.
- [ ] Exclude unpaid temporary holds unless product decision says otherwise.
- [ ] Decide whether cancelled bookings remain visible for history.

## 5. Client data boundaries

- [ ] Decide what client contact data therapists can see.
      _Suggested: name, email/phone only for confirmed sessions._
- [ ] Decide whether intake form answers are visible to therapists.
- [ ] Add therapist-scoped client detail fetches if needed.
- [ ] Prevent therapist access to unrelated clients by direct URL guessing.
- [ ] Add tests for cross-therapist data isolation.

## 6. Session notes and clinical privacy

- [ ] Decide whether therapists can create private session notes in the dashboard.
- [ ] If notes are supported, create therapist-owned note storage with RLS.
- [ ] Decide whether admins can view therapist clinical notes.
      _Privacy policy currently implies clinical notes are limited to the therapist and named
      clinical supervision where needed._
- [ ] Add audit events for note creation/update/delete without exposing note contents.
- [ ] Add export/deletion policy for clinical notes if required.

## 7. Availability and schedule management

- [ ] Decide if therapists can update recurring availability.
- [ ] Decide if therapists can block out unavailable dates.
- [ ] If enabled, add therapist-scoped availability mutations.
- [ ] Ensure therapist availability changes still respect admin/service assignment rules.
- [ ] Add conflict checks before saving availability changes.

## 8. Notifications and calendar

- [ ] Decide whether therapists receive dashboard notifications for new confirmed sessions.
- [ ] Show Google Calendar sync status for therapist appointments.
- [ ] Provide a "copy Meet link" action for online sessions.
- [ ] Decide whether therapists can resend session links to clients.
      _Recommended: no, keep client communication through admin/system templates first._

## 9. Per-therapist Google Calendar connection

- [ ] Confirm that every therapist can connect their own Google Calendar remotely.
      _Reason: therapists may work from different locations and need personal calendar ownership._
- [ ] Reuse the existing `therapist_google_connections` foundation where possible.
- [ ] Add a secure therapist-facing Google connect button/link inside the therapist dashboard.
- [ ] Ensure connect links are signed, short-lived, and scoped to one therapist profile.
- [ ] Ensure a therapist can only connect or disconnect the Google account linked to their own
      therapist profile.
- [ ] Keep admin-initiated connection support for staff-assisted setup if still needed.
- [ ] Store the connected Google email and connection status for display to therapist and admin.
- [ ] Add reconnect flow for expired/revoked Google tokens.
- [ ] Add disconnect flow with confirmation.
- [ ] Ensure connected therapists receive confirmed bookings on their own Google Calendar.
- [ ] Ensure online appointments create/store a Google Meet link when sync succeeds.
- [ ] Ensure appointment details sent to Google include safe details only:
      booking reference, client name, service, mode, time, and meeting link.
- [ ] Avoid syncing unpaid holds or uncommitted Paystack-initiated bookings to therapist calendars.
- [ ] Delete or update Google Calendar events when bookings are cancelled, archived, or rescheduled.
- [ ] Sync therapist busy blocks from their Google Calendar for real-time availability checks.
- [ ] If a therapist is connected, availability should consider both Talk Space availability rules
      and Google Calendar busy periods.
- [ ] If a therapist is not connected, availability should fall back to Talk Space admin-set
      availability only.
- [ ] Show a clear admin/dashboard warning when a therapist has no connected calendar:
      _"Real-time Google availability is unavailable; using Talk Space schedule only."_
- [ ] Email therapists booking details even when Google Calendar is not connected.
- [ ] Send therapist email notifications/reminders for confirmed appointments.
- [ ] Include Google Meet links in therapist email notifications when available.
- [ ] Log Google connection, disconnect, sync failure, and reconnect events for audit.
- [ ] Add retry controls for failed calendar syncs.
- [ ] Add tests for connected therapist calendar sync.
- [ ] Add tests for unconnected therapist email fallback.
- [ ] Add tests that one therapist cannot connect or inspect another therapist's calendar.
- [ ] Add tests that Google busy periods block public booking slots.
- [ ] Add production smoke test for one connected therapist and one unconnected therapist.

## 10. Admin controls

- [ ] Add therapist account connection controls in `/admin/therapists`.
- [ ] Add "send invite" or "reset access" flow for therapist users.
- [ ] Show whether a therapist profile has a linked login user.
- [ ] Allow admin to disable therapist dashboard access without deleting the public profile.
- [ ] Log admin access-management actions in audit logs.

## 11. Testing and verification

- [ ] Unit/contract tests for therapist role guard.
- [ ] Unit/contract tests that therapist appointment queries filter by therapist id.
- [ ] Tests that therapist users cannot access `/admin`.
- [ ] Tests that therapist A cannot fetch therapist B appointments.
- [ ] Tests that archived/unpaid temporary bookings are hidden.
- [ ] Browser test for therapist login and dashboard load.
- [ ] Browser test for stale session/inactivity logout state.
- [ ] Production smoke test after release.

## 12. Rollout plan

- [ ] Create the first therapist test user in Supabase.
- [ ] Link the test user to a therapist profile.
- [ ] Connect Google Calendar for one test therapist.
- [ ] Leave one test therapist unconnected to verify email fallback.
- [ ] Confirm dashboard shows only that therapist's sessions.
- [ ] Confirm admin still sees all therapist schedules.
- [ ] Confirm bookings under the connected therapist appear on their Google Calendar.
- [ ] Confirm bookings under the unconnected therapist send email but skip calendar sync.
- [ ] Confirm public booking flow remains unchanged.
- [ ] Document therapist onboarding steps for staff.
