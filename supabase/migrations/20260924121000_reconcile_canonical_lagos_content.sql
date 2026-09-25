-- Reconcile the current footer record when it still contains the superseded
-- Lagos address. Administrator-edited values that already differ are left
-- untouched; code fallbacks and page seed content are updated separately.
UPDATE public.site_settings
SET value = jsonb_set(
  value,
  '{offices}',
  jsonb_build_array(
    jsonb_build_object(
      'name', 'Abuja (FCT)',
      'addressLines', jsonb_build_array(
        'Plot 153A, T-Pumpy Estate',
        'Opp. NIU Estate, Off Saburi 1, FCT, Abuja'
      )
    ),
    jsonb_build_object(
      'name', 'Talk Space Counseling, Lagos',
      'addressLines', jsonb_build_array(
        'Abiodun Oshowole Cl, off Oluwaleimu Street',
        'Allen, Ikeja 101233, Lagos'
      )
    )
  ),
  true
)
WHERE key = 'footer_settings'
  AND value::text ILIKE '%Estaport%';

-- Update imported page content only when it still contains one of the known
-- superseded office strings. This is intentionally exact-string replacement;
-- unrelated editorial mentions are not rewritten.
UPDATE public.content_entries
SET body_html = replace(
  replace(
    replace(
      replace(
        body_html,
        '20, Estaport Avenue, Gbagada, Lagos, Nigeria',
        'Talk Space Counselling - Lagos, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos'
      ),
      '20c, Estaport Avenue, Soluyi, Gbagada, Lagos',
      'Talk Space Counselling - Lagos, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos'
    ),
    '20, Estaport Avenue, Soluyi, 105102, Gbagada, Lagos',
    'Talk Space Counselling - Lagos, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos'
  ),
  'Ladipo Kasumu Street, Ikeja, Lagos, Nigeria.',
  'Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos'
)
WHERE body_html ILIKE '%Estaport%'
   OR body_html ILIKE '%Ladipo Kasumu Street%';
