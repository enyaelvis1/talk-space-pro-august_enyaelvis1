# Talk Space product scope and booking rules

This document captures the current product decisions reflected in the app and
supporting docs. It is the working scope reference for the checklist item:
“Confirm inclusions, exclusions, staff roles, services, prices, and booking
rules.”

It is intentionally practical, not legal advice. If any item below changes, the
public pages, admin settings, and checklist notes should be updated together.

## 1) What is included

Talk Space currently includes:

- Confidential counselling and psychotherapy for individuals, couples,
  families, teens, children, and organisations.
- Online sessions and in-person sessions where the therapist and service allow
  it.
- Public website content for services, therapists, pricing, blog/journal,
  about, contact, FAQs, and booking.
- Admin-managed content for pages, journal posts, testimonials, FAQs, homepage
  blocks, carousel items, media, Google Reviews, therapists, services, and
  site settings.
- Secure booking, payment, client record, and operational flows that support the
  counselling service.

## 2) What is excluded

Talk Space does not currently position itself as:

- A crisis or emergency service.
- A guarantee of specific outcomes.
- A place for unsupervised session recording without therapist consent.

Public legal and emergency copy already reinforces this:

- `Talk Space is not a crisis or emergency service.`
- `Talk Space provides counselling but cannot guarantee specific outcomes.`

## 3) Staff and account roles

Current working roles in the product are:

- `admin` — full workspace access for CMS, settings, content operations, client
  records, payments, and admin-only areas.
- `staff` — therapist/operations access for care work and assigned client
  records, depending on the route and policy.
- `client` — the signed-in care recipient who can book, manage appointments,
  and access their own account area.

Role language on the public site should stay simple:

- “Talk Space administrators” for admin-only areas.
- “Licensed therapist” or “care team” for client-facing copy.
- “Client” for the person booking or managing care.

## 4) Service catalogue

These are the services currently reflected in the public pages and database
seed.

| Code                   | Public name                 |   Duration | Price                                | Current note                       |
| ---------------------- | --------------------------- | ---------: | ------------------------------------ | ---------------------------------- |
| `clarity_call`         | Clarity Call                |     15 min | Contact for pricing                  | Paid intro call / service-fit call |
| `individual`           | Individual Therapy          |     60 min | ₦55,000 online / ₦85,000 in person   | Mode-based price                   |
| `couple`               | Couple Therapy              |     90 min | ₦90,000 online / ₦130,000 in person  | Mode-based price                   |
| `organizational`       | Organizational Counselling  |     60 min | Contact for pricing                  | Custom quote                       |
| `premarital`           | Premarital Counselling      |     90 min | Contact for pricing                  | Structured package                 |
| `infidelity_recovery`  | Infidelity Recovery Therapy |     60 min | Contact for pricing                  | Specialist package                 |
| `teen_child`           | Teen/Child Therapy          |     60 min | ₦50,000                              | Fixed price                        |
| `family`               | Family Therapy              |     90 min | Contact for pricing                  | Custom or specialist pricing       |
| `one_month_individual` | One-Month Individual Plan   | 4 sessions | ₦210,000 online / ₦323,000 in person | Monthly package                    |
| `one_month_couple`     | One-Month Couple Plan       | 4 sessions | ₦342,000 online / ₦494,000 in person | Monthly package                    |
| `psychotherapy`        | Psychotherapy Assessment    |     60 min | ₦100,000                             | Specialist assessment              |

### Public service categories

The public services page groups the catalogue into:

- Clarity Call
- Individual Therapy
- Couple Therapy
- Organizational Counselling
- Premarital Counselling
- Infidelity Recovery Therapy
- Teen/Child Therapy
- Family Therapy

## 5) Booking rules

The current booking flow follows these rules:

- The booking form collects the client’s name, email, phone, service, session
  mode, preferred date, preferred time, and notes.
- The system matches the request to an available therapist and session slot.
- Clarity Calls are 15 minutes.
- Therapy sessions are confirmed by service type and may be online or in person
  depending on the service and therapist availability.
- Bookings within 24 hours of the session are only allowed when therapist
  availability supports them.
- Rescheduling or cancellation must happen at least 48 hours before the
  session.
- Requests inside the 48-hour window may be treated as a no-show and are
  non-refundable.
- Minors aged 13–17 must be booked by a parent or legal guardian.
- The booking experience is not an emergency intake path.

## 6) Payment rules

The current product shows the payment flow as follows:

- Prices are shown publicly on the pricing page.
- Paystack is the primary online payment provider.
- Bank transfer remains available as a manual fallback.
- The booking confirmation experience can surface payment details after the
  request is created and scheduled.

If the payment sequence changes later, update this document and the public
pricing/booking copy together.

## 7) Content and UI guardrails

- Use the short brand name `Talk Space` in navigation and headings.
- Use `Talk Space Counselling Services` in metadata, legal pages, and formal
  references.
- Keep `Journal` as the public name for the blog area.
- Keep `Book a call` as the primary CTA label.
- Keep the site wording warm, professional, and non-emergency in tone.

## 8) Open follow-up decisions

The next checklist item asks us to confirm:

- Providers
- Cost ownership
- Retention owners
- Success measures

Those are intentionally left open here and should be decided separately so we
do not blur product scope with operational ownership.
