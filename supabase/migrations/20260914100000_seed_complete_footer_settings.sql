-- Seed every footer-owned field without replacing administrator edits.
insert into public.site_settings (key, value)
values (
  'footer_settings',
  jsonb_build_object(
    'crisisHeading', 'In a crisis?',
    'crisisText', 'Talk Space is not an emergency service.',
    'crisisCtaLabel', 'Get emergency support',
    'crisisCtaHref', '/emergency-support',
    'description', 'Talk Space supports individuals and couples working through emotional, behavioural and thinking challenges brought on by stress, trauma, life circumstances or relationship difficulties.',
    'contactAddress', '',
    'offices', jsonb_build_array(
      jsonb_build_object(
        'name', 'Abuja (FCT)',
        'addressLines', jsonb_build_array(
          'Plot 153A, T-Pumpy Estate',
          'Opp. NIU Estate, Off Saburi 1, FCT, Abuja'
        )
      ),
      jsonb_build_object(
        'name', 'Lagos',
        'addressLines', jsonb_build_array(
          '20, Estaport Avenue',
          'Gbagada, Lagos, Nigeria'
        )
      )
    ),
    'sections', jsonb_build_array(
      jsonb_build_object('title', 'Services', 'links', jsonb_build_array(
        jsonb_build_object('label', 'All services', 'to', '/services'),
        jsonb_build_object('label', 'Individual therapy', 'to', '/services'),
        jsonb_build_object('label', 'Couples counselling', 'to', '/services'),
        jsonb_build_object('label', 'Family therapy', 'to', '/services'),
        jsonb_build_object('label', 'Group sessions', 'to', '/services')
      )),
      jsonb_build_object('title', 'Talk Space', 'links', jsonb_build_array(
        jsonb_build_object('label', 'About us', 'to', '/about'),
        jsonb_build_object('label', 'Our therapists', 'to', '/therapists'),
        jsonb_build_object('label', 'Pricing', 'to', '/pricing'),
        jsonb_build_object('label', 'Journal', 'to', '/blog'),
        jsonb_build_object('label', 'Contact', 'to', '/contact')
      )),
      jsonb_build_object('title', 'Support', 'links', jsonb_build_array(
        jsonb_build_object('label', 'FAQs', 'to', '/faqs'),
        jsonb_build_object('label', 'Book a session', 'to', '/book'),
        jsonb_build_object('label', 'Emergency support', 'to', '/emergency-support'),
        jsonb_build_object('label', 'Privacy policy', 'to', '/privacy-policy'),
        jsonb_build_object('label', 'Terms of service', 'to', '/terms'),
        jsonb_build_object('label', 'Cancellation & refunds', 'to', '/cancellation-refund-policy')
      ))
    ),
    'bottomLeft', '© {year} {brandName}. All rights reserved.',
    'bottomRight', 'Sessions are confidential. Ethical practice, always.',
    'showSocialLinks', true
  )
)
on conflict (key) do update
set value = excluded.value || public.site_settings.value;
