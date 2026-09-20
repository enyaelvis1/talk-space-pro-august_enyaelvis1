# Talk Space product terminology and section map

This document is the working glossary for the Talk Space implementation backlog.
It gives us a single vocabulary for the product, the public website, and the
admin workspace so the remaining checklist items stay consistent.

## Canonical product names

- Full legal/marketing name: `Talk Space Counselling Services`
- Short brand name: `Talk Space`
- Public-facing support brand in headings and copy: `Talk Space`
- Admin workspace label: `Admin workspace`
- Admin console label: `Admin console`

## Approved content terms

Use these labels consistently in code, CMS screens, and checklist items:

- `Home` — the public landing page
- `Services` — the public services listing
- `Therapists` — the public therapist directory
- `Pricing` — the public pricing page
- `About` — the public about page
- `Journal` — the public blog/news page
- `Contact` — the public contact page
- `FAQs` — the public questions page
- `Book` / `Booking` — the confidential session request flow
- `Account` — the signed-in client area
- `Pages` — database-backed standalone content pages
- `Hero section` — the editable homepage hero content
- `Homepage sections` — the visibility/order controls for the homepage blocks
- `Homepage carousel` — the homepage specialties carousel
- `Testimonials` — client review cards in the admin and on the public site
- `Google Reviews` — the review trust settings and outbound review link
- `Media library` — uploaded images and public assets
- `Redirects` — legacy URL mapping and migration support

## Remaining product section map

The remaining implementation checklist is organised into these top-level
sections. Keep the numbering stable when adding future work so the progress
tracker stays aligned.

1. Documentation and scope
2. Repository foundation
3. Brand/design
4. Public shell
5. Public pages
6. CMS
7. Authentication
8. Availability
9. Booking
10. Client management
11. Forms
12. Paystack
13. Bank transfer
14. Google
15. Email
16. Contact/WhatsApp
17. Admin operations
18. Migration
19. SEO/performance/a11y
20. Security/privacy
21. Testing/QA
22. Deployment
23. Launch/handover
24. Maintenance
25. Calenira-inspired design refresh
26. Admin CMS and website management
27. Remaining implementation plan

## Routing and UI vocabulary

Prefer the following route labels and sidebar names so users see a consistent
map across the app:

- `/` — Home
- `/services` — Services
- `/therapists` — Therapists
- `/pricing` — Pricing
- `/about` — About
- `/blog` — Journal
- `/contact` — Contact
- `/faqs` — FAQs
- `/book` — Book a call
- `/account` — Account
- `/admin` — Dashboard
- `/admin/progress` — Project progress
- `/admin/pages` — Pages
- `/admin/hero` — Hero section
- `/admin/homepage` — Homepage sections
- `/admin/carousel` — Homepage carousel
- `/admin/journal` — Journal
- `/admin/media` — Media library
- `/admin/testimonials` — Testimonials
- `/admin/google-reviews` — Google Reviews
- `/admin/faqs` — FAQs
- `/admin/redirects` — Redirects
- `/admin/services` — Services
- `/admin/therapists` — Therapists
- `/admin/settings` — Settings

## Notes for future changes

- If a UI label changes, update this document first, then update the
  corresponding route title, sidebar label, and checklist wording.
- Keep the short brand `Talk Space` for headers and navigation, while preserving
  the full name `Talk Space Counselling Services` in metadata, legal copy, and
  formal references.
- Treat `Journal` as the public-facing label and `blog` as the route path.
- Treat `Booking` as the product flow and `Book a call` as the primary CTA.
