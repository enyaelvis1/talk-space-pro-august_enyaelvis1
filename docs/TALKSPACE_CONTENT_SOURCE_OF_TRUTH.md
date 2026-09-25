# Talk Space content and pricing source of truth

Reviewed: 24 September 2026

This matrix prevents a missing or stale CMS row from silently reintroducing old
client-facing content. The CMS/database value is authoritative when valid; the
listed code fallback is a safe recovery path and must remain aligned with the
approved value.

| Surface | Authoritative value | Local fallback/recovery | Update path | Verification |
| --- | --- | --- | --- | --- |
| Practice name, phone, email, offices, social links | `src/lib/talkspace.ts` constants until the site-details CMS row is normalized | Same constants | Admin Settings for site details and footer; reviewed migration for known stale address strings | Footer, Contact, About, email preview, structured data |
| Footer offices | `site_settings.footer_settings.offices` | `TS.addresses` | Admin Settings; `20260924121000_reconcile_canonical_lagos_content.sql` only replaces known superseded Lagos values | Footer and booking/payment preview with row present and absent |
| Public page copy | Published `content_entries` page/section data | `src/lib/page-seed-content.ts` | CMS editor and reviewed seed/migration | Public route, draft preview, published/draft distinction |
| Lagos office wording | Approved value: `Talk Space Counselling - Lagos, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos` | `TS.addresses[1]` | Admin/CMS content plus canonical content migration | Contact, locator, About/privacy copy, in-person email and admin preview |
| Online service price | `services.price_ngn` | No silent fallback for missing online price | Admin Services | Pricing, booking, Paystack, bank-transfer amount, receipt |
| In-person service price | `services.in_person_price_ngn` | `IN_PERSON_PRICE_BY_SERVICE_CODE` only for approved known service codes; otherwise unavailable | Admin Services and reviewed pricing migration | In-person pricing, booking, Paystack, bank transfer, receipt |
| Email subject/body | `email_template_settings.subject_override` and `body_override` when nonblank | Code-managed templates in `src/lib/email-templates.server.ts` | Admin Emails; allowlisted placeholders only | Preview, delivery log, redacted staging email |
| Bank-transfer instructions | `payment_settings.bank_name`, `bank_account_name`, `bank_account_number`, `bank_instructions` | No fake bank details; payment option remains disabled or incomplete until configured | Admin Payments | Booking checkout, mobile layout, admin review queue |
| Google review summary/list | `site_settings.google_reviews` after an authorized provider refresh | Existing published review set is preserved on provider failure | Admin Google Reviews or protected refresh hook | Last refresh/source/error, CSV, public carousel |

## Rules

1. A missing CMS row may use the code fallback, but a malformed value must not
   silently mix old and new office data.
2. Payment amounts are integer NGN minor units at the provider boundary. A
   missing explicit in-person price means “not configured”, not “use online”.
3. Historical migrations are immutable history. New reconciliation migrations
   may update only known superseded values and must preserve administrator-edited
   content and images.
4. Provider failures preserve the last known published Google review set and
   expose the failure to administrators.
5. Staging UAT must verify both valid CMS rows and fallback/missing-row paths
   before any production content change.
