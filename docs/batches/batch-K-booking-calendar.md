# Batch K — Booking calendar experience

**Sections:** 09

## Scope

- Replace the list-only booking overview with a calendar-first admin experience.
- Provide a clickable calendar view for appointments across dates.
- Support an enlarged day/detail view that surfaces what is happening now, the date, time, therapist, and client at a glance.
- Apply the same compact overview pattern to upcoming sessions so the admin can scan what is next without visual clutter.
- Keep the existing booking operations data intact while improving the presentation and interaction model.

## Proposed implementation plan

- Add a calendar view to the admin bookings experience using the existing booking data source.
- Render appointment markers on calendar days and allow clicking a day to open a detail panel or modal.
- Build a compact agenda section for the selected day with appointment cards showing:
  - time
  - therapist
  - client
  - status
  - session mode
- Add a “now / next” summary for the current day and upcoming sessions.
- Keep the layout responsive so it works well on desktop and tablet without overwhelming the screen.
- Preserve the existing timeline, reminder, and sync actions for each appointment.

## Acceptance criteria

- Admins can view appointments in a calendar layout instead of only a table/list.
- Clicking a date reveals the sessions scheduled for that day in a readable detail panel.
- The selected day view makes it easy to identify appointments happening now and upcoming sessions.
- The UI remains usable when many sessions are present and avoids visual clutter.
- Existing booking actions such as reminders and timeline access continue to work.

## Suggested implementation order

1. Add a calendar-based bookings view to the admin experience.
2. Wire appointment data into the calendar and selected-day panel.
3. Add the “now / next” summary and compact session cards.
4. Polish responsive layout and interaction states.
5. Add or update regression coverage for the new booking calendar view.
