-- Keep the physical-session address editable from Admin > Settings and preserve
-- any value an administrator has already configured.
UPDATE public.site_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'physicalSessionAddress',
  'Talk Space Counselling - Lagos, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos'
)
WHERE key = 'footer_settings'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'physicalSessionAddress');
