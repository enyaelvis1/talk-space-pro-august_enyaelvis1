# Paystack Legacy-Link Inventory — 2026-10-12

This is a source inventory for identifying payment paths that may bypass the current booking/payment flow. It is not an instruction to delete or rewrite live content.

## Active runtime references

`src/lib/talkspace.ts` currently contains direct Paystack buy-link constants for historical service/package identifiers:

- `https://paystack.com/buy/vit`
- `https://paystack.com/buy/vcc`
- `https://paystack.com/buy/omp`
- `https://paystack.com/buy/vchpaz`

These constants require a product-owner mapping to the current `/book` or `/purchase` flow before replacement. The mapping must preserve service, mode, amount, client association, and payment confirmation behavior.

## Historical seed/migration references

`supabase/migrations/20260715120000_talkspace_content_seed.sql` contains historical direct Paystack buy-link values, including identifiers such as:

- `vit`
- `itos`
- `omp`
- `vcc`
- `ctos`
- `vchpaz`
- `vpc`
- `irt`
- `vmms`

Historical migration files are retained for reproducibility. They must not be edited retroactively in this branch. Any live CMS/content replacement requires an explicitly reviewed content migration or an admin-controlled update in the correct environment.

## Other discovered source

`public/store-locator/locator-plus.html` contains a configured `https://paystack.shop/tscs` action that is rewritten at runtime to the local `/book` route. This should be confirmed with the Paystack export and the admin/CMS owner so the source is either retired or intentionally retained.

## Required reconciliation before closure

1. Export the suspicious Paystack transactions and classify each reference by source/payment page.
2. Match each provider reference to an application payment record, webhook event, or legacy-link path.
3. Confirm whether any direct/legacy link remains publicly reachable or was used during the suspicious window.
4. Map every active legacy service identifier to a current internal service before changing runtime behavior.
5. Disable or replace confirmed obsolete links through the approved content/configuration process.
6. Add a provider-owner confirmation and browser UAT evidence to the hardening checklist.

## Current status

Inventory complete; live-link retirement is blocked on provider reconciliation and service mapping. No remote content, database row, migration, or provider setting was changed by this inventory.
