# Talk Space — Privacy, Booking Notifications, Content, and SEO Checklist

Review date: 19 October 2026  
Scope: consolidated checklist from therapist/client feedback and the latest
content review.

This checklist separates urgent privacy and booking behavior from content and
search improvements. A checkbox means the work is complete only after the
implementation, focused automated checks, staging/UAT, and the relevant
production verification have passed.

## Status legend

- `[ ]` Not started.
- `[~]` Partially implemented or awaiting a product decision/evidence.
- `[x]` Implemented and verified for this checklist item.
- `[!]` Blocked until the named decision or access is available.

## Release order

- [~] **P0 — Privacy and account isolation:** stop unintended client details
  appearing on the confirmed-payment view and therapist dashboard; verify that
  one partner cannot see another user's dashboard or account data.
- [~] **P0 — Couple booking notifications:** collect and validate the invited
  partner's name, email, and optional WhatsApp number, then notify both people
  exactly once for the booking/payment lifecycle.
- [~] **P1 — Pricing and service source of truth:** reconcile Teen/Child Therapy
  duration and the free introductory call versus paid Clarity Call.
- [ ] **P1 — Public content reliability:** fix FAQ and therapist-page loading
  states and verify published content works without authenticated access.
- [~] **P1 — Focused service pages:** add approved landing pages and connect each
  page to the correct booking/service option.
- [~] **P2 — Local search and editorial improvements:** add Lagos/Abuja pages,
  internal links, authorship, and clinical-content review.

## 1. P0 privacy and account isolation

### 1.1 Reproduce and map the exposure

- [ ] Capture the exact route, account, browser, and timestamp where client
  details appear.
- [ ] Reproduce with two disposable synthetic accounts: a couple/partner
  account and a therapist account. Do not use real client data in screenshots or
  test artifacts.
- [ ] Check whether the report concerns `/admin/payments` confirmed rows,
  `/therapist`, `/account`, or the public `/therapists` page.
- [ ] Trace the complete data path: server function selection, authorization
  check, response payload, client state/cache, and rendered fields.
- [ ] Inspect browser storage/session state for stale user IDs, reused tabs,
  cached loader data, or an incorrect Supabase session after switching users.
- [ ] Confirm the public therapist query returns therapist fields only and never
  joins or serializes client, appointment, payment, intake, or note data.

### 1.2 Remove client details from the confirmed-payment view

- [ ] Define the minimum information the payer needs after confirmation:
  booking reference, service, therapist, date/time, mode, payment status, and
  next step.
- [ ] Remove client email, phone, notes, intake answers, and partner details
  from the confirmed-payment response and UI unless explicitly required by the
  approved product decision.
- [ ] Ensure the payment page does not fetch or render a second person's client
  record merely because the booking is for a couple.
- [ ] Review server logs, error messages, analytics payloads, and page metadata
  for accidental client-detail leakage.

### 1.3 Restrict therapist dashboard data

- [ ] Confirm therapist authorization is checked before every dashboard read;
  never rely on a client-side role or hidden UI control.
- [ ] Scope appointment reads by the authenticated therapist's linked
  `therapist_id`; test denial for another therapist, a client, an unlinked user,
  and a signed-out request.
- [ ] Decide the least-privilege therapist view. Recommended default: first
  name, booking reference, service, session time, mode, and approved contact
  method only; hide email, phone, notes, payment data, and intake details unless
  clinically/operationally justified and approved.
- [x] Remove unapproved client fields from the server response, not only from
  the rendered component.
- [ ] Keep `Cache-Control: private, no-store` on therapist responses and verify
  that browser back/forward navigation does not reveal the previous therapist's
  data.
- [x] Add regression tests asserting that the public therapist profile payload
  and therapist dashboard payload cannot contain unapproved client fields.

### 1.4 Fix account/session contamination

- [ ] Verify the wife/partner dashboard report with fresh browser profiles and
  separate sessions, not only the same browser tab.
- [ ] On sign-out, clear or invalidate user-specific query/cache state before a
  different user can sign in.
- [ ] Ensure route loaders revalidate the authenticated user when navigating
  between `/account`, `/therapist`, and admin routes.
- [ ] Confirm a therapist account cannot be redirected into or render another
  user's dashboard because of stale loader data.
- [ ] Add cross-account UAT evidence with redacted synthetic names.

## 2. P0 couple booking and dual notifications

### 2.1 Booking data and consent

- [x] Add an explicit **Invite partner** section to the booking form for couple
  services: partner name, partner email, and optional WhatsApp number.
- [ ] Explain why the details are collected, who receives notifications, and how
  the partner can opt out or request correction.
- [ ] Validate partner email and phone formats; normalize phone numbers to the
  approved Nigeria/international format.
- [ ] Prevent the primary client and partner from being silently swapped or
  duplicated.
- [ ] Keep partner details separate from the primary client's private profile
  and clinical notes.
- [x] Decide whether the partner becomes a separate client record, a booking
  participant, or only a notification recipient. Document the decision before
  migration.

### 2.2 Notification delivery

- [ ] Send the booking confirmation to the primary client and partner when both
  have valid consent and email addresses.
- [ ] Send payment confirmation to both recipients only after payment state is
  verified; never send a success message for an incomplete or failed payment.
- [ ] Apply the same recipient policy to confirmation, reschedule, cancellation,
  reminder, Meet-link, and package-session messages.
- [ ] Deduplicate delivery per booking, recipient, template, and event so
  retries do not send duplicates.
- [ ] Keep partner email/phone out of therapist emails unless separately
  approved; use the least amount of contact information required for care.
- [ ] Record notification claims and delivery outcomes without storing message
  bodies containing unnecessary sensitive data.
- [ ] Test email provider failures, retries, missing partner email, duplicate
  webhooks, reschedules, cancellations, and partial delivery.

### 2.3 Couple-booking UAT

- [ ] Primary client receives booking and payment confirmations.
- [ ] Partner receives booking and payment confirmations.
- [ ] Therapist receives only the approved operational notification.
- [ ] Admin can see the booking relationship without exposing unnecessary
  details in list views.
- [ ] A non-participant cannot access either client's details using a booking
  reference or URL.
- [ ] Archived/cancelled bookings do not trigger new reminders or duplicate
  notifications.

## 3. P1 pricing and consultation consistency

### 3.1 Source-of-truth decision

- [ ] Decide the approved duration for Teen/Child Therapy: 50 or 60 minutes.
- [ ] Decide whether the introductory call is free, paid Clarity Call, or two
  distinct offerings with different names, durations, prices, and booking
  rules.
- [ ] Record the approved service code, duration, price, mode availability,
  description, and Paystack/payment behavior in the source-of-truth matrix.

### 3.2 Reconcile every surface

- [ ] Services page and homepage.
- [ ] Pricing page and package cards.
- [ ] Booking service selector and duration labels.
- [ ] Availability/slot calculations and calendar events.
- [ ] Checkout, receipts, payment ledger, and admin payment review.
- [ ] Confirmation/reminder emails and WhatsApp copy.
- [ ] SEO title, description, structured data, and internal links.
- [ ] Admin CMS/editor fallback content and seeded migration values.
- [ ] Add a regression test that fails if the same service has conflicting public
  duration or consultation labels.

## 4. P1 focused service pages

- [ ] Approve the initial page set: Individual Therapy, Couples Counselling,
  Child and Teen Therapy, Premarital Counselling, and other priority services.
- [ ] Give each page a stable route, canonical URL, title, meta description, and
  one clear booking CTA.
- [ ] Include audience, concerns supported, session format/duration, therapist
  matching, confidentiality boundaries, pricing link, FAQs, and next step.
- [ ] Avoid promises, diagnoses, or clinical claims that have not been reviewed
  by the clinical/content owner.
- [ ] Link each page to the relevant therapist profiles, pricing, booking
  service, privacy policy, and related journal articles.
- [ ] Add redirects for any existing URLs that are renamed.
- [ ] Verify responsive layout, accessibility, no-JavaScript fallback, loading
  state, and public unauthenticated access.

## 5. P2 Lagos and Abuja local search pages

- [ ] Confirm the actual services, office availability, address, hours,
  directions, and booking rules for Lagos and Abuja before publishing.
- [ ] Create separate location pages only where Talk Space has a real service or
  a clearly described online coverage area.
- [ ] Add unique local copy, service availability, transport/directions content,
  contact details, and a location-specific booking CTA.
- [ ] Add consistent NAP data, canonical URLs, Open Graph metadata, and valid
  structured data where appropriate.
- [ ] Do not claim an office, Google listing, local team, or in-person service
  that has not been verified by the owner.
- [ ] Add internal links from the footer, contact page, relevant services, and
  booking flow without creating doorway-page duplication.
- [ ] Submit the approved sitemap/indexing changes and verify canonical/index
  status after deployment.

## 6. P1 public content reliability and editorial review

### 6.1 FAQs and therapist pages

- [ ] Reproduce the crawl's loading messages on a fresh unauthenticated browser.
- [ ] Verify FAQ and therapist data requests return within an acceptable bound
  and render meaningful content or a clear error state.
- [ ] Check that loading placeholders do not remain in server-rendered HTML or
  accessibility trees after data has loaded.
- [ ] Verify empty, slow, failed, and partial-data states.
- [ ] Confirm public endpoints do not require an authenticated session or leak
  private fields.
- [ ] Add a smoke test for HTTP status, content type, visible headings, and
  representative FAQ/therapist content.

### 6.2 Internal linking and clinical authorship

- [ ] Link relevant journal articles to service pages, pricing, booking, and
  therapist profiles.
- [ ] Link service pages back to relevant articles and approved therapist
  expertise without implying endorsement beyond the evidence.
- [ ] Add visible author/reviewer attribution and review dates to clinical or
  mental-health content.
- [ ] Have the clinical owner review terminology, safety guidance, crisis links,
  confidentiality statements, and claims before publication.
- [ ] Check alt text, heading order, link labels, keyboard navigation, and
  mobile layout for all updated pages.
- [ ] Validate sitemap inclusion, canonical URLs, robots rules, metadata, and
  structured data after content changes.

## 7. Verification and release gate

- [ ] Run focused unit/contract tests for privacy fields, role isolation,
  couple recipients, notification deduplication, and pricing consistency.
- [ ] Run TypeScript, ESLint, build, and `git diff --check`.
- [ ] Run browser UAT with synthetic accounts: primary client, partner, two
  therapists, admin, and signed-out visitor.
- [ ] Inspect network responses—not only the rendered UI—for client fields on
  public therapist pages, confirmed payment pages, and therapist dashboards.
- [ ] Review Supabase API/Auth/Storage logs for authorization failures, repeated
  notification calls, and accidental sensitive response payloads.
- [ ] Confirm no secrets, real client details, private screenshots, or test
  credentials are committed.
- [ ] Merge through `feature/*` → `develop`, complete UAT, then use a separate
  approved `develop` → `main` release PR.
- [ ] Deploy only the verified `main` commit and verify the public site, booking
  flow, payment confirmation, notification recipients, and therapist isolation
  after deployment.

## Decisions required before implementation

- [ ] Which client fields, if any, may a therapist see during an assigned
  session?
- [ ] Should a couple partner be a separate client record or a booking-only
  participant?
- [ ] Should partners receive every lifecycle notification or only booking and
  payment confirmations?
- [ ] Is Teen/Child Therapy 50 or 60 minutes?
- [ ] Is the introductory call free, paid, or two separate offerings?
- [ ] Which Lagos and Abuja locations/services are currently real and approved
  for public publication?
- [ ] Who is the clinical reviewer and who approves final service-page copy?
