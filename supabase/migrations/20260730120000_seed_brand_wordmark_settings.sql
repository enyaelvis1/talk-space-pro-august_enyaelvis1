-- Default site branding to the responsive TALK SPACE wordmark on fresh
-- databases only. Existing admin-edited branding and images must be preserved.
insert into public.site_settings (key, value)
values (
  'site_details',
  jsonb_build_object(
    'brandName', 'Talk Space Counselling Services',
    'logoPath', ''
  )
)
on conflict (key) do nothing;
