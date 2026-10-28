-- Let the public FAQ page read the admin-managed category order while
-- keeping all other site settings restricted to their existing allowlist.
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
    'home_pricing',
    'google_reviews',
    'site_details',
    'form_templates',
    'footer_settings',
    'faq_category_order'
  )
);
