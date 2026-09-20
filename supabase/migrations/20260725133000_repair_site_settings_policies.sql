-- Repair CMS settings permissions so admins can persist homepage-managed content.
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write
on public.site_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read
on public.site_settings
for select
to anon, authenticated
using (key in ('home_hero', 'home_specialties', 'home_sections', 'google_reviews', 'site_details'));
