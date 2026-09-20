-- Allow the public homepage to read all admin-managed homepage settings it renders.
drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings
for select
to anon, authenticated
using (
  key in (
    'home_hero',
    'home_specialties',
    'home_specialty_cards',
    'home_sections',
    'home_section_copy',
    'google_reviews',
    'site_details',
    'form_templates'
  )
);
