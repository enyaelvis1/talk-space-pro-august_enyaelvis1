-- Allow the public homepage to read the admin-managed pricing teaser setting.
-- Keep the previously public homepage settings in the same consolidated policy.

drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings for select
to anon, authenticated
using (
  key in (
    'home_hero',
    'home_specialties',
    'home_specialty_cards',
    'home_sections',
    'home_section_copy',
    'home_pricing',
    'google_reviews',
    'site_details',
    'form_templates',
    'footer_settings'
  )
);
