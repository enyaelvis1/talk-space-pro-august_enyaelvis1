-- Allow the public booking and contact pages to read the admin-managed form templates.
drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings
for select
to anon, authenticated
using (key in ('home_hero', 'home_specialties', 'home_sections', 'google_reviews', 'site_details', 'form_templates'));
