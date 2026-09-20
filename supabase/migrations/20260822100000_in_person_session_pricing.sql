-- Add distinct pricing for physical / in-person sessions.
-- `price_ngn` remains the online price; `in_person_price_ngn` is used when
-- an appointment is booked with session_mode = 'in_person'.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS in_person_price_ngn numeric(12, 2)
  CHECK (in_person_price_ngn IS NULL OR in_person_price_ngn >= 0);

COMMENT ON COLUMN public.services.in_person_price_ngn IS
  'Physical / in-person session price in NGN. Falls back to price_ngn when null.';

UPDATE public.services
SET in_person_price_ngn = CASE code
  WHEN 'individual' THEN 85000
  WHEN 'couple' THEN 130000
  WHEN 'one_month_individual' THEN 323000
  WHEN 'one_month_couple' THEN 494000
  ELSE in_person_price_ngn
END
WHERE code IN ('individual', 'couple', 'one_month_individual', 'one_month_couple');

WITH physical AS (
  SELECT jsonb_build_object(
    'id', 'pricing-in-person',
    'type', 'cardGrid',
    'hidden', false,
    'surface', 'cream',
    'spacing', 'md',
    'width', 'wide',
    'align', 'left',
    'eyebrow', 'In-person sessions',
    'heading', 'Physical sessions at our rooms.',
    'body', 'For clients who prefer face-to-face support. In-person sessions are available by appointment.',
    'columns', 4,
    'cards', jsonb_build_array(
      jsonb_build_object(
        'id', 'price-in-person-individual',
        'title', 'Individual In-person Session',
        'tagline', '₦85,000 · per 60-minute session',
        'body', 'One-to-one counselling in a private Talk Space room, tailored to your treatment goals.',
        'bullets', jsonb_build_array(
          'Physical session by appointment',
          'Private counselling room',
          'CBT-informed support',
          'Personalised next steps after session'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=individual&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'price-in-person-couple',
        'title', 'Couple In-person Session',
        'tagline', '₦130,000 · per 90-minute session',
        'body', 'Face-to-face couple therapy for communication, trust repair, conflict and intimacy.',
        'bullets', jsonb_build_array(
          'Physical couple session',
          'Couple assessment and profiling',
          'Communication and conflict skills',
          'Infidelity-sensitive support when needed'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=couple&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'price-in-person-month-individual',
        'title', 'One-Month Individual In-person',
        'tagline', '₦323,000 · 4 individual sessions monthly',
        'body', 'Four face-to-face individual therapy sessions with the same therapist.',
        'bullets', jsonb_build_array(
          'Four physical sessions',
          'Consistent therapist match',
          'Progress tracking between sessions',
          'Structured short-course care'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=one_month_individual&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'price-in-person-month-couple',
        'title', 'One-Month Couple In-person',
        'tagline', '₦494,000 · 4 couple sessions monthly',
        'body', 'A structured month of in-person couple therapy for reconnection and repair.',
        'bullets', jsonb_build_array(
          'Four physical couple sessions',
          'Assessment-led treatment plan',
          'Communication and intimacy work',
          'Support for recurring conflict cycles'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=one_month_couple&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      )
    )
  ) AS section
),
expanded AS (
  SELECT ce.id, section_item.section, section_item.ordinality
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sections')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'pricing'
    AND jsonb_typeof(ce.metadata -> 'sections') = 'array'
),
flags AS (
  SELECT
    id,
    bool_or(section ->> 'id' = 'pricing-single') AS has_single
  FROM expanded
  GROUP BY id
),
items AS (
  SELECT
    expanded.id,
    expanded.ordinality * 2 AS sort_order,
    expanded.section
  FROM expanded
  WHERE expanded.section ->> 'id' <> 'pricing-in-person'

  UNION ALL

  SELECT
    expanded.id,
    expanded.ordinality * 2 + 1 AS sort_order,
    physical.section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN physical
  WHERE flags.has_single
    AND expanded.section ->> 'id' = 'pricing-single'

  UNION ALL

  SELECT
    flags.id,
    max(expanded.ordinality) * 2 + 1 AS sort_order,
    physical.section
  FROM flags
  JOIN expanded ON expanded.id = flags.id
  CROSS JOIN physical
  WHERE NOT flags.has_single
  GROUP BY flags.id, physical.section
),
updated_sections AS (
  SELECT id, jsonb_agg(section ORDER BY sort_order) AS sections
  FROM items
  GROUP BY id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sections}', updated_sections.sections, false),
  source_modified_at = now(),
  updated_at = now()
FROM updated_sections
WHERE ce.id = updated_sections.id;

WITH physical AS (
  SELECT jsonb_build_object(
    'id', 'pricing-in-person',
    'type', 'cardGrid',
    'hidden', false,
    'surface', 'cream',
    'spacing', 'md',
    'width', 'wide',
    'align', 'left',
    'eyebrow', 'In-person sessions',
    'heading', 'Physical sessions at our rooms.',
    'body', 'For clients who prefer face-to-face support. In-person sessions are available by appointment.',
    'columns', 4,
    'cards', jsonb_build_array(
      jsonb_build_object(
        'id', 'price-in-person-individual',
        'title', 'Individual In-person Session',
        'tagline', '₦85,000 · per 60-minute session',
        'body', 'One-to-one counselling in a private Talk Space room, tailored to your treatment goals.',
        'bullets', jsonb_build_array(
          'Physical session by appointment',
          'Private counselling room',
          'CBT-informed support',
          'Personalised next steps after session'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=individual&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'price-in-person-couple',
        'title', 'Couple In-person Session',
        'tagline', '₦130,000 · per 90-minute session',
        'body', 'Face-to-face couple therapy for communication, trust repair, conflict and intimacy.',
        'bullets', jsonb_build_array(
          'Physical couple session',
          'Couple assessment and profiling',
          'Communication and conflict skills',
          'Infidelity-sensitive support when needed'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=couple&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'price-in-person-month-individual',
        'title', 'One-Month Individual In-person',
        'tagline', '₦323,000 · 4 individual sessions monthly',
        'body', 'Four face-to-face individual therapy sessions with the same therapist.',
        'bullets', jsonb_build_array(
          'Four physical sessions',
          'Consistent therapist match',
          'Progress tracking between sessions',
          'Structured short-course care'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=one_month_individual&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      ),
      jsonb_build_object(
        'id', 'price-in-person-month-couple',
        'title', 'One-Month Couple In-person',
        'tagline', '₦494,000 · 4 couple sessions monthly',
        'body', 'A structured month of in-person couple therapy for reconnection and repair.',
        'bullets', jsonb_build_array(
          'Four physical couple sessions',
          'Assessment-led treatment plan',
          'Communication and intimacy work',
          'Support for recurring conflict cycles'
        ),
        'image', jsonb_build_object('src', '', 'alt', ''),
        'href', '/book?service=one_month_couple&mode=in_person',
        'linkLabel', 'Start secure booking',
        'tone', 'default'
      )
    )
  ) AS section
),
expanded AS (
  SELECT ce.id, section_item.section, section_item.ordinality
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sectionsDraft')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'pricing'
    AND jsonb_typeof(ce.metadata -> 'sectionsDraft') = 'array'
),
flags AS (
  SELECT
    id,
    bool_or(section ->> 'id' = 'pricing-single') AS has_single
  FROM expanded
  GROUP BY id
),
items AS (
  SELECT
    expanded.id,
    expanded.ordinality * 2 AS sort_order,
    expanded.section
  FROM expanded
  WHERE expanded.section ->> 'id' <> 'pricing-in-person'

  UNION ALL

  SELECT
    expanded.id,
    expanded.ordinality * 2 + 1 AS sort_order,
    physical.section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN physical
  WHERE flags.has_single
    AND expanded.section ->> 'id' = 'pricing-single'

  UNION ALL

  SELECT
    flags.id,
    max(expanded.ordinality) * 2 + 1 AS sort_order,
    physical.section
  FROM flags
  JOIN expanded ON expanded.id = flags.id
  CROSS JOIN physical
  WHERE NOT flags.has_single
  GROUP BY flags.id, physical.section
),
updated_draft_sections AS (
  SELECT id, jsonb_agg(section ORDER BY sort_order) AS sections_draft
  FROM items
  GROUP BY id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sectionsDraft}', updated_draft_sections.sections_draft, false),
  updated_at = now()
FROM updated_draft_sections
WHERE ce.id = updated_draft_sections.id;
