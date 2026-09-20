-- Add or refresh the About story split section directly after the values grid.
-- Existing CMS-backed pages keep their stored metadata, so this migration makes
-- the public About page match the refreshed design without a manual reseed.

WITH story AS (
  SELECT jsonb_build_object(
    'id', 'about-story',
    'type', 'hero',
    'hidden', false,
    'surface', 'page',
    'spacing', 'md',
    'width', 'wide',
    'align', 'left',
    'eyebrow', 'Our story',
    'heading', 'Built in Lagos. Made for anywhere you are.',
    'headingEmphasis', '',
    'headingAfter', '',
    'body', 'Talk Space began in 2017 with a simple observation: too many people in Nigeria who wanted therapy either could not find a therapist they trusted, could not afford the ones they did find, or were held back by stigma.

Today, our care coordinators match hundreds of clients each month with licensed therapists, online across Nigeria, and in person at our rooms in Gbagada, Lagos. We keep our fees transparent, hold a limited number of sliding-scale slots, and never take payment until your session is confirmed.

If you are considering therapy for the first time, you are welcome here. The first conversation is often the hardest, and the most important.',
    'image', jsonb_build_object(
      'src', 'content-media/therapists/2026/08/b17cf861-9ef993a5-750797197-1617088680024620-7808186723757096404-n-13.jpg',
      'alt', 'Talk Space therapist seated in a counselling room'
    ),
    'links', '[]'::jsonb
  ) AS section
),
expanded AS (
  SELECT
    ce.id,
    section_item.section,
    section_item.ordinality
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sections')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'about'
    AND jsonb_typeof(ce.metadata -> 'sections') = 'array'
),
flags AS (
  SELECT
    id,
    bool_or(section ->> 'id' = 'about-story') AS has_story
  FROM expanded
  GROUP BY id
),
items AS (
  SELECT
    expanded.id,
    expanded.ordinality * 2 AS sort_order,
    CASE
      WHEN expanded.section ->> 'id' = 'about-story' THEN story.section
      ELSE expanded.section
    END AS section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN story

  UNION ALL

  SELECT
    expanded.id,
    expanded.ordinality * 2 + 1 AS sort_order,
    story.section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN story
  WHERE NOT flags.has_story
    AND expanded.section ->> 'id' = 'about-values'
),
updated_sections AS (
  SELECT
    id,
    jsonb_agg(section ORDER BY sort_order) AS sections
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

WITH story AS (
  SELECT jsonb_build_object(
    'id', 'about-story',
    'type', 'hero',
    'hidden', false,
    'surface', 'page',
    'spacing', 'md',
    'width', 'wide',
    'align', 'left',
    'eyebrow', 'Our story',
    'heading', 'Built in Lagos. Made for anywhere you are.',
    'headingEmphasis', '',
    'headingAfter', '',
    'body', 'Talk Space began in 2017 with a simple observation: too many people in Nigeria who wanted therapy either could not find a therapist they trusted, could not afford the ones they did find, or were held back by stigma.

Today, our care coordinators match hundreds of clients each month with licensed therapists, online across Nigeria, and in person at our rooms in Gbagada, Lagos. We keep our fees transparent, hold a limited number of sliding-scale slots, and never take payment until your session is confirmed.

If you are considering therapy for the first time, you are welcome here. The first conversation is often the hardest, and the most important.',
    'image', jsonb_build_object(
      'src', 'content-media/therapists/2026/08/b17cf861-9ef993a5-750797197-1617088680024620-7808186723757096404-n-13.jpg',
      'alt', 'Talk Space therapist seated in a counselling room'
    ),
    'links', '[]'::jsonb
  ) AS section
),
expanded AS (
  SELECT
    ce.id,
    section_item.section,
    section_item.ordinality
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sectionsDraft')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'about'
    AND jsonb_typeof(ce.metadata -> 'sectionsDraft') = 'array'
),
flags AS (
  SELECT
    id,
    bool_or(section ->> 'id' = 'about-story') AS has_story
  FROM expanded
  GROUP BY id
),
items AS (
  SELECT
    expanded.id,
    expanded.ordinality * 2 AS sort_order,
    CASE
      WHEN expanded.section ->> 'id' = 'about-story' THEN story.section
      ELSE expanded.section
    END AS section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN story

  UNION ALL

  SELECT
    expanded.id,
    expanded.ordinality * 2 + 1 AS sort_order,
    story.section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN story
  WHERE NOT flags.has_story
    AND expanded.section ->> 'id' = 'about-values'
),
updated_draft_sections AS (
  SELECT
    id,
    jsonb_agg(section ORDER BY sort_order) AS sections_draft
  FROM items
  GROUP BY id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sectionsDraft}', updated_draft_sections.sections_draft, false),
  updated_at = now()
FROM updated_draft_sections
WHERE ce.id = updated_draft_sections.id;

-- Remove the duplicate freeform hero that was added while iterating on the
-- About story section. The canonical page intro remains `about-hero`; the
-- designed story split remains `about-story`.
WITH filtered_sections AS (
  SELECT
    ce.id,
    jsonb_agg(section_item.section ORDER BY section_item.ordinality) AS sections
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sections')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'about'
    AND jsonb_typeof(ce.metadata -> 'sections') = 'array'
    AND NOT (
      section_item.section ->> 'id' = 'hero-msp79f5r-u4nmvl'
      OR (
        section_item.section ->> 'type' = 'hero'
        AND section_item.section ->> 'id' LIKE 'hero-%'
        AND section_item.section ->> 'eyebrow' = 'About Talk Space'
        AND coalesce(section_item.section ->> 'body', '') LIKE 'Before Talk Space was a practice%'
      )
    )
  GROUP BY ce.id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sections}', filtered_sections.sections, false),
  source_modified_at = now(),
  updated_at = now()
FROM filtered_sections
WHERE ce.id = filtered_sections.id;

WITH filtered_draft_sections AS (
  SELECT
    ce.id,
    jsonb_agg(section_item.section ORDER BY section_item.ordinality) AS sections_draft
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sectionsDraft')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'about'
    AND jsonb_typeof(ce.metadata -> 'sectionsDraft') = 'array'
    AND NOT (
      section_item.section ->> 'id' = 'hero-msp79f5r-u4nmvl'
      OR (
        section_item.section ->> 'type' = 'hero'
        AND section_item.section ->> 'id' LIKE 'hero-%'
        AND section_item.section ->> 'eyebrow' = 'About Talk Space'
        AND coalesce(section_item.section ->> 'body', '') LIKE 'Before Talk Space was a practice%'
      )
    )
  GROUP BY ce.id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sectionsDraft}', filtered_draft_sections.sections_draft, false),
  updated_at = now()
FROM filtered_draft_sections
WHERE ce.id = filtered_draft_sections.id;
