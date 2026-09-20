-- Add the Billing FAQ section to the CMS-backed Pricing page.
-- The hardcoded fallback already contains this content; this keeps existing
-- published CMS rows in step with the refreshed public design.

WITH faq AS (
  SELECT jsonb_build_object(
    'id', 'pricing-faq',
    'type', 'faq',
    'hidden', false,
    'surface', 'page',
    'spacing', 'lg',
    'width', 'wide',
    'align', 'left',
    'eyebrow', 'Billing FAQ',
    'heading', 'Common questions about fees.',
    'body', '',
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', 'payment-timing',
        'question', 'When is payment taken?',
        'answer', 'Payments are processed securely via Paystack when you book. If you need to reschedule or cancel, do so at least 48 hours in advance.'
      ),
      jsonb_build_object(
        'id', 'payment-methods',
        'question', 'What payment methods do you accept?',
        'answer', 'Card (Visa, Mastercard, Verve), bank transfer and USSD via Paystack. Corporate invoicing is available for HR-sponsored programmes.'
      ),
      jsonb_build_object(
        'id', 'diaspora-pricing',
        'question', 'Do you offer diaspora pricing?',
        'answer', 'Yes. USD equivalents are shown for each plan and you can pay in either currency via Paystack.'
      ),
      jsonb_build_object(
        'id', 'package-booking',
        'question', 'Can I book a package rather than pay per session?',
        'answer', 'Yes. Our one-month plans (four sessions) are the most affordable way to commit to a short course of therapy.'
      )
    )
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
    AND ce.slug = 'pricing'
    AND jsonb_typeof(ce.metadata -> 'sections') = 'array'
),
flags AS (
  SELECT
    id,
    bool_or(section ->> 'id' = 'pricing-faq') AS has_faq,
    bool_or(section ->> 'id' = 'pricing-note') AS has_note
  FROM expanded
  GROUP BY id
),
items AS (
  SELECT
    expanded.id,
    expanded.ordinality * 2 AS sort_order,
    CASE
      WHEN expanded.section ->> 'id' = 'pricing-faq' THEN faq.section
      ELSE expanded.section
    END AS section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN faq

  UNION ALL

  SELECT
    expanded.id,
    expanded.ordinality * 2 + 1 AS sort_order,
    faq.section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN faq
  WHERE NOT flags.has_faq
    AND flags.has_note
    AND expanded.section ->> 'id' = 'pricing-note'

  UNION ALL

  SELECT
    flags.id,
    max(expanded.ordinality) * 2 + 1 AS sort_order,
    faq.section
  FROM flags
  JOIN expanded ON expanded.id = flags.id
  CROSS JOIN faq
  WHERE NOT flags.has_faq
    AND NOT flags.has_note
  GROUP BY flags.id, faq.section
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

WITH faq AS (
  SELECT jsonb_build_object(
    'id', 'pricing-faq',
    'type', 'faq',
    'hidden', false,
    'surface', 'page',
    'spacing', 'lg',
    'width', 'wide',
    'align', 'left',
    'eyebrow', 'Billing FAQ',
    'heading', 'Common questions about fees.',
    'body', '',
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', 'payment-timing',
        'question', 'When is payment taken?',
        'answer', 'Payments are processed securely via Paystack when you book. If you need to reschedule or cancel, do so at least 48 hours in advance.'
      ),
      jsonb_build_object(
        'id', 'payment-methods',
        'question', 'What payment methods do you accept?',
        'answer', 'Card (Visa, Mastercard, Verve), bank transfer and USSD via Paystack. Corporate invoicing is available for HR-sponsored programmes.'
      ),
      jsonb_build_object(
        'id', 'diaspora-pricing',
        'question', 'Do you offer diaspora pricing?',
        'answer', 'Yes. USD equivalents are shown for each plan and you can pay in either currency via Paystack.'
      ),
      jsonb_build_object(
        'id', 'package-booking',
        'question', 'Can I book a package rather than pay per session?',
        'answer', 'Yes. Our one-month plans (four sessions) are the most affordable way to commit to a short course of therapy.'
      )
    )
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
    AND ce.slug = 'pricing'
    AND jsonb_typeof(ce.metadata -> 'sectionsDraft') = 'array'
),
flags AS (
  SELECT
    id,
    bool_or(section ->> 'id' = 'pricing-faq') AS has_faq,
    bool_or(section ->> 'id' = 'pricing-note') AS has_note
  FROM expanded
  GROUP BY id
),
items AS (
  SELECT
    expanded.id,
    expanded.ordinality * 2 AS sort_order,
    CASE
      WHEN expanded.section ->> 'id' = 'pricing-faq' THEN faq.section
      ELSE expanded.section
    END AS section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN faq

  UNION ALL

  SELECT
    expanded.id,
    expanded.ordinality * 2 + 1 AS sort_order,
    faq.section
  FROM expanded
  JOIN flags ON flags.id = expanded.id
  CROSS JOIN faq
  WHERE NOT flags.has_faq
    AND flags.has_note
    AND expanded.section ->> 'id' = 'pricing-note'

  UNION ALL

  SELECT
    flags.id,
    max(expanded.ordinality) * 2 + 1 AS sort_order,
    faq.section
  FROM flags
  JOIN expanded ON expanded.id = flags.id
  CROSS JOIN faq
  WHERE NOT flags.has_faq
    AND NOT flags.has_note
  GROUP BY flags.id, faq.section
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
