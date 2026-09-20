-- Allow the public homepage to read its administrator-managed section layout.
drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings
for select
to anon, authenticated
using (key in ('home_hero', 'home_specialties', 'home_sections', 'google_reviews', 'site_details'));
