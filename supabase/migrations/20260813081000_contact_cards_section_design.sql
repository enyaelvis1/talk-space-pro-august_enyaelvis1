-- Align the published Contact card grids with the refreshed six-card layout.
-- Existing CMS-backed pages keep using their stored metadata, so update the
-- contact channel and office sections directly.

WITH contact_cards AS (
  SELECT
    jsonb_build_array(
      jsonb_build_object(
        'id', 'contact-whatsapp',
        'title', 'WhatsApp',
        'tagline', 'Fastest response · Mon-Fri, 9am-5pm',
        'body', '+234 704 846 9090',
        'bullets', '[]'::jsonb,
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', 'https://wa.me/2347048469090',
        'linkLabel', 'Open in WhatsApp',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-phone',
        'title', 'Phone (Nigeria)',
        'tagline', 'Mon-Fri, 9am-5pm WAT',
        'body', '+234 809 993 1039',
        'bullets', '[]'::jsonb,
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', 'tel:+2348099931039',
        'linkLabel', 'Call now',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-email',
        'title', 'Email',
        'tagline', 'Replies within one working day',
        'body', 'hello@talkspace.ng',
        'bullets', '[]'::jsonb,
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', 'mailto:hello@talkspace.ng',
        'linkLabel', 'Send an email',
        'tone', 'default'
      )
    ) AS channels,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'contact-abuja',
        'title', 'Abuja (FCT)',
        'tagline', '',
        'body', 'Plot 153A, T-Pumpy Estate
Opp. NIU Estate, Off Saburi 1, FCT, Abuja',
        'bullets', jsonb_build_array('In-person sessions by appointment only.'),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '',
        'linkLabel', '',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-lagos',
        'title', 'Lagos',
        'tagline', '',
        'body', '20, Estaport Avenue
Gbagada, Lagos, Nigeria',
        'bullets', jsonb_build_array('In-person sessions by appointment only.'),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '',
        'linkLabel', '',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-hours',
        'title', 'Hours',
        'tagline', '',
        'body', '',
        'bullets', jsonb_build_array(
          'Monday to Friday: 9:00 to 17:00',
          'Saturday: By appointment',
          'Sunday: Closed'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '',
        'linkLabel', '',
        'tone', 'default'
      )
    ) AS offices
),
updated_sections AS (
  SELECT
    ce.id,
    jsonb_agg(
      CASE
        WHEN section_item.section ->> 'id' = 'contact-channels' THEN
          section_item.section ||
          jsonb_build_object(
            'eyebrow', '',
            'heading', '',
            'body', '',
            'columns', 3,
            'surface', 'page',
            'spacing', 'md',
            'width', 'wide',
            'cards', contact_cards.channels
          )
        WHEN section_item.section ->> 'id' = 'contact-offices' THEN
          section_item.section ||
          jsonb_build_object(
            'eyebrow', '',
            'heading', '',
            'body', '',
            'columns', 3,
            'surface', 'page',
            'spacing', 'md',
            'width', 'wide',
            'cards', contact_cards.offices
          )
        ELSE section_item.section
      END
      ORDER BY section_item.ordinality
    ) AS sections
  FROM public.content_entries ce
  CROSS JOIN contact_cards
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sections')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'contact'
    AND jsonb_typeof(ce.metadata -> 'sections') = 'array'
  GROUP BY ce.id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sections}', updated_sections.sections, false),
  source_modified_at = now(),
  updated_at = now()
FROM updated_sections
WHERE ce.id = updated_sections.id;

WITH contact_cards AS (
  SELECT
    jsonb_build_array(
      jsonb_build_object(
        'id', 'contact-whatsapp',
        'title', 'WhatsApp',
        'tagline', 'Fastest response · Mon-Fri, 9am-5pm',
        'body', '+234 704 846 9090',
        'bullets', '[]'::jsonb,
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', 'https://wa.me/2347048469090',
        'linkLabel', 'Open in WhatsApp',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-phone',
        'title', 'Phone (Nigeria)',
        'tagline', 'Mon-Fri, 9am-5pm WAT',
        'body', '+234 809 993 1039',
        'bullets', '[]'::jsonb,
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', 'tel:+2348099931039',
        'linkLabel', 'Call now',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-email',
        'title', 'Email',
        'tagline', 'Replies within one working day',
        'body', 'hello@talkspace.ng',
        'bullets', '[]'::jsonb,
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', 'mailto:hello@talkspace.ng',
        'linkLabel', 'Send an email',
        'tone', 'default'
      )
    ) AS channels,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'contact-abuja',
        'title', 'Abuja (FCT)',
        'tagline', '',
        'body', 'Plot 153A, T-Pumpy Estate
Opp. NIU Estate, Off Saburi 1, FCT, Abuja',
        'bullets', jsonb_build_array('In-person sessions by appointment only.'),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '',
        'linkLabel', '',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-lagos',
        'title', 'Lagos',
        'tagline', '',
        'body', '20, Estaport Avenue
Gbagada, Lagos, Nigeria',
        'bullets', jsonb_build_array('In-person sessions by appointment only.'),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '',
        'linkLabel', '',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'contact-hours',
        'title', 'Hours',
        'tagline', '',
        'body', '',
        'bullets', jsonb_build_array(
          'Monday to Friday: 9:00 to 17:00',
          'Saturday: By appointment',
          'Sunday: Closed'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '',
        'linkLabel', '',
        'tone', 'default'
      )
    ) AS offices
),
updated_draft_sections AS (
  SELECT
    ce.id,
    jsonb_agg(
      CASE
        WHEN section_item.section ->> 'id' = 'contact-channels' THEN
          section_item.section ||
          jsonb_build_object(
            'eyebrow', '',
            'heading', '',
            'body', '',
            'columns', 3,
            'surface', 'page',
            'spacing', 'md',
            'width', 'wide',
            'cards', contact_cards.channels
          )
        WHEN section_item.section ->> 'id' = 'contact-offices' THEN
          section_item.section ||
          jsonb_build_object(
            'eyebrow', '',
            'heading', '',
            'body', '',
            'columns', 3,
            'surface', 'page',
            'spacing', 'md',
            'width', 'wide',
            'cards', contact_cards.offices
          )
        ELSE section_item.section
      END
      ORDER BY section_item.ordinality
    ) AS sections_draft
  FROM public.content_entries ce
  CROSS JOIN contact_cards
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sectionsDraft')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'contact'
    AND jsonb_typeof(ce.metadata -> 'sectionsDraft') = 'array'
  GROUP BY ce.id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sectionsDraft}', updated_draft_sections.sections_draft, false),
  updated_at = now()
FROM updated_draft_sections
WHERE ce.id = updated_draft_sections.id;
