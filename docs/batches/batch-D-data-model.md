# Batch D — Data model

**Sections:** 08 (Availability), 10 (Client management)

## Scope

Tables (all with GRANTs + RLS):

- `services` (individual, couple, teen_child, one_month_individual, one_month_couple, psychotherapy)
- `therapists` (profile, bio, specialties[], modalities[])
- `therapist_services` (join)
- `availability_rules` (weekly recurring)
- `availability_exceptions` (blocked/added slots)
- service scheduling policy (`buffer_before_minutes`, `buffer_after_minutes`,
  `minimum_lead_time_minutes`)
- `clients` (linked to `auth.users`)
- `client_notes` (staff-only, admin-visible)

## Acceptance

- Seed data present via migration.
- RLS: client sees only their own row; staff sees assigned clients; admin sees all.

## Implementation status

- Migration `20260715100000_data_model_foundation.sql` defines and seeds services,
  therapists, therapist-service relationships, availability primitives, clients,
  and staff-only client notes.
- New auth users receive a client row through the existing signup trigger.
- Migration `20260715140000_service_scheduling_policy.sql` adds service-level
  buffer and minimum lead-time fields with safe zero defaults. The booking batch
  will consume these fields when calculating slots.
- Protected `/admin/clients/:clientId` provides a responsive client detail view
  with profile data, care preferences, activity timestamps, and staff-only notes.
- Bookings and appointment history remain in the booking batch.
