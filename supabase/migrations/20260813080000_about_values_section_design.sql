-- Align the published About values block with the refreshed visual design.
-- The renderer has a section-specific layout for `about-values`; this updates
-- existing CMS content so the public copy and page-builder defaults match it.

WITH updated_sections AS (
  SELECT
    ce.id,
    jsonb_agg(
      CASE
        WHEN section_item.section ->> 'id' = 'about-values' THEN
          section_item.section ||
          jsonb_build_object(
            'eyebrow', 'Our values',
            'heading', 'Four commitments we hold every session.',
            'columns', 4,
            'surface', 'page',
            'spacing', 'md',
            'width', 'wide'
          )
        ELSE section_item.section
      END
      ORDER BY section_item.ordinality
    ) AS sections
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sections')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'about'
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

WITH updated_draft_sections AS (
  SELECT
    ce.id,
    jsonb_agg(
      CASE
        WHEN section_item.section ->> 'id' = 'about-values' THEN
          section_item.section ||
          jsonb_build_object(
            'eyebrow', 'Our values',
            'heading', 'Four commitments we hold every session.',
            'columns', 4,
            'surface', 'page',
            'spacing', 'md',
            'width', 'wide'
          )
        ELSE section_item.section
      END
      ORDER BY section_item.ordinality
    ) AS sections_draft
  FROM public.content_entries ce
  CROSS JOIN LATERAL jsonb_array_elements(ce.metadata -> 'sectionsDraft')
    WITH ORDINALITY AS section_item(section, ordinality)
  WHERE ce.kind = 'page'
    AND ce.slug = 'about'
    AND jsonb_typeof(ce.metadata -> 'sectionsDraft') = 'array'
  GROUP BY ce.id
)
UPDATE public.content_entries ce
SET
  metadata = jsonb_set(ce.metadata, '{sectionsDraft}', updated_draft_sections.sections_draft, false),
  updated_at = now()
FROM updated_draft_sections
WHERE ce.id = updated_draft_sections.id;
