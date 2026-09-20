# SEO, performance, and accessibility verification — 2 August 2026

## Deployment tested

`https://talk-space-production-2u149xwic-enyasystems-projects.vercel.app`

## Core Web Vitals

The mobile Lighthouse gate passed:

- Performance: 94
- Largest Contentful Paint: 2.47 seconds
- Total Blocking Time: 12.5 milliseconds
- Cumulative Layout Shift: 0.0001

Machine-readable evidence: [`performance/home-core-web-vitals.json`](performance/home-core-web-vitals.json).

## Keyboard and screen-reader verification

The rendered-browser audit checked `/`, `/services`, `/therapists`, `/pricing`, `/blog`,
`/contact`, and `/faqs`. It exercises the skip link, tab order, keyboard activation,
landmarks, accessible names, Chrome accessibility tree, and axe WCAG 2.2 AA rules.

- Serious or critical axe violations: 0
- Keyboard checks: passed
- Landmark and accessibility-tree checks: passed

Machine-readable evidence:
[`accessibility/public-accessibility-audit.json`](accessibility/public-accessibility-audit.json).

## Reproduction

```bash
npm run qa:cwv -- https://talk-space-production-2u149xwic-enyasystems-projects.vercel.app
npm run qa:a11y -- https://talk-space-production-2u149xwic-enyasystems-projects.vercel.app
```

The separate all-category Lighthouse/axe checklist item remains partial until mobile
performance, accessibility, best-practices, and SEO scores are captured together for the
full agreed route set.
