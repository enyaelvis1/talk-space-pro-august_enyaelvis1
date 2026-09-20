-- Allow the public site details used by the footer and contact links to be read anonymously.

drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings for select
to anon, authenticated
using (key in ('home_hero', 'site_details'));
