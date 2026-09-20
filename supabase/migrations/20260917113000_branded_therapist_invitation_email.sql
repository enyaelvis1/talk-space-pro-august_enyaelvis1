insert into public.email_template_settings (template_key, display_name, description, is_enabled)
values (
  'therapist_account_invitation',
  'Therapist account invitation',
  'Sent through the configured Talk Space email provider when a therapist login is created.',
  true
)
on conflict (template_key) do update
set
  display_name = excluded.display_name,
  description = excluded.description;
