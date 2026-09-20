# Operations Fix Checklist - 2026-09-06

Status key: `[ ]` not started, `[~]` in progress, `[x]` complete, `[!]` blocked.

## Booking Administration

- [x] Add an obvious admin edit flow on `/admin/bookings`.
- [~] Verify staff can change a booking date and time from available slots.
- [ ] Confirm reschedule emails are still sent after admin changes.

## Google Calendar And Meet Links

- [x] Trace the booking flow from payment success to Google event creation and email content.
- [x] Show Google Meet sync status in admin booking cards.
- [~] Verify a confirmed online booking creates a Google Calendar event and stores a Meet link.
- [x] Document expected behavior: unpaid or unverified bookings do not include a Meet link.

## Paystack Verification

- [x] Improve admin feedback for test-mode verification failures.
- [~] Verify the saved public and secret keys are from the same Paystack account and mode.
- [ ] Recheck callback and webhook status for a fresh test transaction.

## Booking Date Picker

- [x] Replace the native date input with the shared typed date field and explicit calendar popover.
- [~] Browser-test that typing is not blocked and the calendar only opens from the icon.

## Release

- [x] Run lint, tests, and build.
- [ ] Push the feature branch.
- [ ] Open the pull request into `develop`.
