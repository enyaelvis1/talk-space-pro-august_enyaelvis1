alter table public.appointments
  add column if not exists therapist_notification_claimed_at timestamptz;

insert into public.email_template_settings (template_key, display_name, description, is_enabled)
values (
  'therapist_booking_notice',
  'Therapist booking notice',
  'Sent to the assigned therapist after a booking is paid and confirmed.',
  true
)
on conflict (template_key) do update
set
  display_name = excluded.display_name,
  description = excluded.description;
