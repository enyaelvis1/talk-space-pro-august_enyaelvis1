# Client Feedback Checklist

Tracking corrections/observations from client review. Grouped by area.

## Status legend

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked

---

## 1. Homepage — "Focused areas of counselling care"

Currently shows six areas; must be **nine**.

- [x] Update heading copy from "Six focused areas" to "Nine focused areas"
- [x] Add **Infidelity Recovery Therapy** card
- [x] Add **Organizational Counselling** card
- [x] Split existing "Premarital & Family" into two distinct cards:
  - [x] **Premarital Counselling** (prepare for marriage, etc.)
  - [x] **Family Therapy** (resolve family conflict, sibling rivalry, strengthen intergenerational relationships, build blended family)
- [x] Verify full list renders as 9 cards on homepage

## 2. Booking & Payment (`/book`, booking flow)

- [x] Copy update: "We confirm sessions as soon as payment is made and the booking is done"
- [x] Enforce reschedule/cancellation policy: **48 hours prior** to session time (surfaced in booking sidebar)
- [x] Allow booking within **24 hours** of session time (date min = today; policy noted)
- [x] Make the "Anything you'd like us to know?" field **required** (`*`, zod min(1), HTML required, error state)

## 3. Services page (`/services`)

Ensure exactly these 7 services are listed, in order:

- [x] Individual Therapy
- [x] Couple Therapy
- [x] Organizational Counselling _(new)_
- [x] Premarital Counselling
- [x] Infidelity Recovery Therapy _(new)_
- [x] Teen/Child Therapy
- [x] Family Therapy
- [x] Add imagery + descriptions for new services (Organizational, Infidelity Recovery)

## 4. Journal (rename Blog → Journal)

- [x] Rename nav label and page heading from "Blog" to "Journal" (kept `/blog` URL)
- [x] Pull blog posts from https://talkspace2.vercel.app/
- [x] Edit + SEO-optimize each post (title, meta, headings, alt text, internal links)
- [x] Migrate posts into `src/lib/blog-posts.ts` (or CMS when ready), preserving current design/effects on `/blog`
- [x] Update per-post `head()` metadata

## 5. Pricing page (`/pricing`)

Reorganize into **three grouped tiers**:

### Single sessions

- [x] Individual Therapy
- [x] Couple Therapy
- [x] Child/Teen Therapy

### Monthly packages

- [x] Individual Plan
- [x] Couple Plan
- [x] Premarital Plan

### Specialized packages

- [x] Psychotherapy
- [x] Infidelity Recovery
- [x] Organizational Counselling

- [x] Update pricing toggle/section layout to reflect the three groups
- [ ] Confirm prices + Paystack links for each new tier

## 6. Story / About page (`/about`)

- [x] Change founding year from **2021 → 2017**
- [x] Update location copy to reference "Our rooms in Gbagada, Lagos"
- [x] Review timeline / milestones for any downstream year references

## 7. Global polish

- [x] Link hover states: highlight brand color on all text links (nav, footer, in-content)
- [x] Audit imagery — swap illustrative/stock for real or humanized AI images of Africans where appropriate
- [x] Add **Clarity Call** as a new paid service (15 minutes) — appears on Services + Pricing + booking flow
  - [ ] Copy, price, duration, Paystack link
  - [x] Availability rule (15-min slot)
- [ ] Show **business bank account details** as an alternative payment method at checkout
  - [ ] Copy: account name, bank, number, reference instructions
  - [ ] Wire into bank-transfer flow (Batch G)

---

## Cross-refs

- Homepage services grid → `src/routes/index.tsx`
- Services list → `src/routes/services.tsx`
- Pricing → `src/routes/pricing.tsx`
- About/Story → `src/routes/about.tsx`
- Blog/Journal → `src/routes/blog.tsx`, `src/routes/blog.$slug.tsx`, `src/lib/blog-posts.ts`
- Booking → `src/routes/book.tsx`
- Constants (Paystack links, contact) → `src/lib/talkspace.ts`
