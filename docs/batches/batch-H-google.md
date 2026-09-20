# Batch H — Google Calendar & Meet

**Sections:** 14

## Scope

- Per-therapist Google OAuth (offline access, refresh token stored server-side).
- On appointment `confirmed`: create Calendar event with Meet link, invite client email.
- On reschedule/cancel: patch/delete event.
- Sync back: if therapist marks event busy in Google, block that slot in `availability_exceptions`.

## Acceptance

- Booking creates a Meet link visible in both therapist and client calendars.
- Cancel removes the event within 30s.
