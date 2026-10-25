# Closeout copy correctness — R01 / R02

Base: origin/develop 4205ae2. No production data, migrations or payment logic changes.

## R01 — duration decision is held

Live evidence on 24 October: Home and Book show Teen/Child 50 minutes; Pricing
shows 60. `services.duration_minutes` drives booking slots and the Book labels;
`site_settings.home_pricing` holds independent homepage copy; Pricing CMS sections
and the code fallback (`service-catalog.ts`, `page-seed-content.ts`) use 60.
The working scope document also says 60, but no signed duration approval was
located. This is not authority to overwrite the live 50-minute service.

Decision D05 for the client/service owner: approve 50 or 60 minutes for single
and monthly Teen/Child sessions, or explicitly specify a different duration per
plan. Explain fee/therapist availability implications. Attach the approved scope
reference. Until then, no duration, pricing, slot calculation or notification
content is changed. After approval, reconcile saved service/CMS values, public
fallbacks, admin displays and actual appointment/end-time/template fixtures.

## R02 — truthful NGN checkout messaging

Fallback and new seed copy now state that checkout is NGN and any USD equivalents
are indicative. Existing saved Pricing FAQ sections, drafts, body HTML and public
FAQ answers have a narrow read-time correction for the known obsolete promise.
This is immutable presentation normalization, not a CMS write or publication.
Unrelated custom copy is preserved. Historical SQL seed migrations remain intact;
their old values are handled at read time. No USD checkout or FX logic is added.

Owner action after release approval: review the saved Pricing FAQ/body and FAQ
table using the normal CMS editor, correct the obsolete promise, and retain its
revision/audit history. Inspect any independently customized currency claims;
the compatibility normalizer intentionally matches the known legacy sentence,
not arbitrary content. No bulk update or remote SQL is included.

## Bounded UAT

1. On an isolated preview/fixture, verify default Pricing FAQ and a saved legacy
   CMS FAQ/body show NGN-only checkout wording. Verify draft preview also agrees.
2. Verify unrelated CMS text is unchanged and raw stored records are untouched.
3. Verify existing NGN checkout summary and indicative USD labels are preserved;
   no real initialization, charge or notification is needed for the copy test.
4. Hold R01 acceptance until written duration approval; do not treat local tests
   as production acceptance or mark the original tracker Done automatically.
