insert into public.email_template_settings (template_key, display_name, description, is_enabled)
values (
  'booking_admin_notice',
  'Booking admin notice',
  'Sent to the care team inbox when a client books a session.',
  true
)
on conflict (template_key) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  is_enabled = public.email_template_settings.is_enabled;
