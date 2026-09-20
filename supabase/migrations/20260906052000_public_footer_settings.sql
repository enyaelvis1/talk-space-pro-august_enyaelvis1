-- Allow the public footer settings to be read anonymously while preserving
-- write access through admin-only server functions.

drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings for select
to anon, authenticated
using (key in ('home_hero', 'site_details', 'footer_settings'));
