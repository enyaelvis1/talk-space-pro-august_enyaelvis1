# Batch B — SEO, performance, accessibility

**Sections:** 19
**Status:** Core Web Vitals and keyboard/screen-reader verification complete; the broader four-category Lighthouse/axe checklist item remains partial.

## Scope

- Canonical tags on every page.
- JSON-LD: Organization on `/`, LocalBusiness on `/contact`, Article on each blog post, FAQPage on `/faqs`.
- `robots.txt` server route referencing `/sitemap.xml`.
- Lazy-load below-the-fold images, add `width`/`height`, use `<picture>` with AVIF where available.
- Run axe + Lighthouse; keyboard-only pass on nav, forms, accordions.

## Acceptance

- Lighthouse ≥ 90 on all four categories, mobile.
- No axe critical/serious violations.
