-- Allow admins to hide real bookings from operational calendars without
-- destroying client/payment history. Temporary test cleanup remains hard-delete.

alter table public.appointments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

create index if not exists appointments_unarchived_starts_at_idx
  on public.appointments (starts_at)
  where archived_at is null;
