# BK-008: Therapist-specific booking slots

Branch: `feature/bk008-therapist-slot-integrity`.
Implementation complete; **Ready for UAT**, not production approved.
This branch includes the preceding local BK-007 and NI-001 commits; neither integration nor production has been updated by this work.

## Audit and fixes

Already implemented and preserved:

- Public slot identity includes therapist ID and start time; de-duplication does not collapse different therapists at the same time.
- The public picker displays therapist names, and checkout sends the selected therapist ID.
- `list_available_slots` filters occupied ranges by therapist ID, across services and session modes. `hold_appointment` verifies the requested therapist against those slots.
- The database exclusion constraint uses therapist ID plus overlapping appointment ranges, not a global service/time key.

Defects fixed in this batch:

- The admin selected-day summary kept only the first appointment that had started. It now displays all current, upcoming, and earlier sessions. The enlarged view marks every live confirmed session as current, rather than one arbitrary booking.
- Admin rescheduling selected by timestamp alone, so two same-time therapist choices could submit the first therapist. It now uses the existing therapist/time key for selection and submission, and displays the therapist's name.
- Client self-service rescheduling previously displayed all therapists' times while submitting only a new time for the original therapist. It now offers the assigned therapist's slots only. Therapist reassignment remains available through admin editing; this does not introduce a new client reassignment workflow.

No booking/availability SQL replacement or new production migration is needed for BK-008. Existing content, images, pricing, and payment rules are unchanged. Mixed-service bookings in the UAT below use separate checkouts; this is not a new mixed-service cart feature.

## Automated coverage

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

To include the real PostgreSQL tests, use a local disposable Supabase/PostgreSQL container:

```bash
BK007_TEST_POSTGRES_CONTAINER=<local-container> npm test
```

BK-008 also accepts `BK008_TEST_POSTGRES_CONTAINER`. Both database tests create/drop their own uniquely named databases and use fixtures with the actual booking, payment, expiry, and rescheduling functions. They never modify the container's application database. Without these variables, database tests are skipped.

New assertions cover same-service and different-service holds/payments at the same time, unassigned therapist exclusion, same-therapist overlap rejection across services/modes, therapist-specific buffers, isolated cancellation, and explicit therapist reassignment. Separate PostgreSQL connections also compete for slots: different therapists both succeed; two requests for the same therapist/time produce one booking and one rejection.

The existing real picker browser test verifies independent therapist selection. New desktop/mobile tests exercise the actual day-section component and calendar grouping with synthetic rows, showing both therapists during and after their sessions. These are component fixtures, not screenshots of authenticated staging bookings.

Local visual evidence: [desktop day panel](../output/playwright/bk008/current-1280.png), [mobile day panel](../output/playwright/bk008/current-390.png). No real clients or tokens are shown.

Local verification (2026-09-13): all 202 tests passed with no skips, including both disposable database suites and desktop/mobile browser tests. TypeScript and the production build passed. Lint passed with seven existing Fast Refresh warnings and no errors. External Paystack, authenticated staging admin flows, and Google Calendar still require the UAT below.

## Staging prerequisites

1. Deploy this feature branch to staging after review. Apply the inherited BK-007 migration if staging does not already have it; BK-008 adds no migration.
2. Create/use therapists A and B, each assigned to the same test service, with overlapping availability in the same mode. Assign a second service to B for the different-service case. Use a third therapist C as an unaffected control.
3. Confirm duration, buffers, timezone, and any imported calendar blocks actually allow the selected time for each therapist. Compare timestamps in the same timezone, preferably Africa/Lagos.
4. Use separate browser profiles and test clients, Paystack test credentials, and staging email/calendar accounts. Complete payment within the existing checkout window.
5. If staging still blocks globally, inspect its schema before changing anything:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and contype in ('x', 'u');
```

The overlap constraint should contain therapist equality and a timestamp range. Booking-reference uniqueness is expected. Report any extra global service/time uniqueness constraint as schema drift; do not drop constraints blindly or run seed migrations to repair it.

## UAT cases

| Case                         | Steps                                                                                                                                                                                              | Expected result and evidence                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same service                 | Book therapist A at a chosen time and complete test payment. In a separate checkout, choose B at that exact time for the same service and pay.                                                     | Both confirmed, distinct references, correct therapists. Save both payment references and an admin calendar screenshot.                                                    |
| Different services           | Repeat at a fresh time with A/service 1 and B/service 2.                                                                                                                                           | Both confirmed even if durations differ, provided each therapist's schedule allows them. Save references and service/therapist details.                                    |
| Same therapist protection    | After A is booked, attempt an overlapping booking for A, including another service or mode.                                                                                                        | Slot absent or rejected; no duplicate appointment. B/C remain available where their schedules permit.                                                                      |
| Concurrent requests          | Use two browsers to submit bookings at nearly the same time. First use different therapists, then the same therapist at a fresh time.                                                              | Different therapists both succeed. Same therapist produces only one hold/booking; the other request is rejected. Save request outcomes and row counts.                     |
| Selected day                 | Open admin bookings and select the shared date, including a synthetic staging example whose sessions are currently in progress. Open the enlarged view too. After they end, inspect the day again. | Both appear under Now while live and Earlier after ending; future sessions both appear under Upcoming. No single-session collapse. Capture desktop and mobile screenshots. |
| Admin rescheduling           | Edit a booking. Find two therapists available at the same new time, select B by name, and save.                                                                                                    | Only B's option is selected and the saved appointment uses B. Verify in the admin calendar and appointment detail.                                                         |
| Client rescheduling          | Open A's valid manage link and choose a new date when only B is available. Then try a date with availability for A.                                                                                | B's time is not offered as though it belongs to A. A's valid new time works, retaining A.                                                                                  |
| Cancellation isolation       | Cancel A's booking while B remains booked at the same time. Refresh availability.                                                                                                                  | A reopens according to the booking rules; B remains blocked. B's reference and appointment are unchanged.                                                                  |
| Therapist/calendar isolation | Log into A and B dashboards separately. If connected, check their staging Google calendars.                                                                                                        | Each dashboard shows its own confirmed booking; each event is on the intended calendar. No cross-therapist client exposure.                                                |

Keep synthetic references and timestamps in the evidence, but redact client contacts, manage tokens, and credentials. Database and browser fixture passes are not substitutes for actual staging payments or Google Calendar checks.

## Release gate

- [x] Audit existing therapist-specific availability and slot identity.
- [x] Fix same-time calendar display and reschedule selection defects.
- [x] Add SQL concurrency, payment, calendar grouping, and browser regression coverage.
- [ ] Run staging UAT and attach references/screenshots to BK-008 in the client checklist.
- [ ] Verify external Paystack and per-therapist Google Calendar behavior.
- [ ] Review feature PR into `develop`, including BK-007/NI-001 dependencies.
- [ ] Mark UAT Passed / Production Ready only after evidence review.
- [ ] Obtain approval for a separate release PR into `main` before production deployment.
