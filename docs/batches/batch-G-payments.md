# Batch G — Payments

**Sections:** 12 (Paystack), 13 (Bank transfer)

## Scope

- Paystack init + verify (server fn); webhook at `/api/public/paystack-webhook` with signature verify.
- Existing Paystack product links preserved: `vit` (individual), `vcc` (couple), `omp` (1-mo individual), `vchpaz` (1-mo couple).
- Bank transfer flow: reference generation, "awaiting confirmation" state, staff confirms in admin.
- Payment ledger table with reconciliation.

## Acceptance

- Successful Paystack payment flips appointment → `confirmed` within 10s of webhook.
- Bank transfer reference is unique per appointment.
