# Paystack Payment-Abuse Evidence Register — 2026-10-12

This register records the evidence needed to close the payment-abuse investigation without exposing secrets or mutating remote systems.

## Local evidence captured

| Evidence | Result | Reference |
|---|---|---|
| Source backup schema checksum | Captured | `536fb3a05c52499a3495f22410f94a974b5d30fc31fa51e9a7a0134aaf4ea029` |
| Source backup data checksum | Captured | `b7fcf2348412271c9c407afc342382bfdeda231aae1e8c67423bf7b5d7d51578` |
| Backup location | Captured | `/home/enyasystem/.local/share/talkspace-backups/2026-10-12-source-export` |
| Backup size | Captured | 115M; contains `schema.sql`, `data.sql`, and `target-connection-script.sh` |
| Focused security tests | Passed | 15/15 in `test/security-hardening.test.ts` |
| Lint | Passed | 0 errors; existing Fast Refresh warnings remain |
| Production build | Passed | `npm run build` |
| Patch whitespace check | Passed | `git diff --check` |
| Browser visual evidence suite | Passed | `node --experimental-strip-types --test test/app-visual.e2e.test.ts` with local Vite server on `127.0.0.1:5173`; bank-transfer, therapist, and admin-payments evidence captured locally |
| Complete local test suite | Passed | `npm test` with the local Vite server on `127.0.0.1:5173`; all non-skipped suites passed, with only intentionally skipped tests requiring configured disposable credentials/local database fixtures |
| Offline reconciliation utility | Passed | `npm run security:reconcile-paystack -- --provider-csv <protected-export> --application-csv <protected-export> --output <protected-report>`; hashes references/emails/IPs and classifies application-linked/provider-only/missing-reference rows |
| Offline abuse-signal detection | Passed | The same utility flags configurable low-value-success, provider-only, repeated-email-activity, and repeated-IP-activity bursts using hashed identifiers; it does not send alerts or contact external systems |

## Required external evidence

| Evidence | Owner | Status | Required handling |
|---|---|---|---|
| Paystack transaction CSV/export for the suspicious window | Paystack account owner | Required | Export references, amounts, channels, timestamps, customer emails, IPs, authorization fingerprints, and statuses. Redact card data. |
| Paystack dashboard audit/access logs | Paystack account owner | Required | Confirm whether transactions came through this integration, a direct payment page, an old link, or another account/user. |
| Vercel request/function logs for payment initialization and webhook routes | Vercel/project owner | Required | Correlate request IDs, status codes, route, timestamp, region, and rate-limit outcomes. Do not export secrets or raw authorization headers. |
| Supabase Auth/audit and application security-event logs | Supabase/project owner | Required | Check admin/auth events, payment initialization events, webhook events, and repeated identifiers. Preserve timestamps in UTC. |
| Provider/API credential rotation review | Project owner | Required | Rotate only if exposure or unauthorized access is confirmed; never record the replacement secret here. |
| Chargeback/refund/dispute review | Finance/Paystack owner | Required | Reconcile successful, failed, refunded, reversed, and disputed transactions before any deletion or refund action. |
| Backup restore rehearsal and checksum verification | Database owner | Required | Use an isolated target only. Do not restore over production or delete existing data. |
| Browser UAT with disposable accounts and sandbox/test references | QA owner | Required | Complete the scenarios in the hardening checklist and attach screenshots/log references without real recipient notifications. |

## Investigation conclusion so far

The local code now verifies webhook signatures and provider payment details, rate-limits payment initialization, binds package purchases to the authenticated client, and emits redacted security events. The screenshots alone do not prove an application-admin compromise: the visible Paystack references and low-value transactions may also originate from direct or historical Paystack payment links.

The 12 October screenshot showing a large Paystack customer list is provider-dashboard evidence, not proof that those customers were created in Talk Space's `clients` table. The repeated synthetic-looking Gmail addresses and low-value activity are consistent with provider-side card testing or a legacy/direct payment surface. The application-to-provider reconciliation step must compare those provider references with Talk Space payment references before attributing them to the application.

The local `paystack_init_failed:401` / `invalid_Key` screenshot is a separate configuration failure. It proves that the local server reached Paystack with a key that Paystack rejected; it does not indicate that the booking amount or client record was accepted. A missing key would produce the application's "Paystack secret key is not configured" error instead. The most likely causes are a stale encrypted key in local `payment_settings`, a revoked key, or a test/live public-secret mismatch.

The account owner supplied two Paystack customer-code examples and confirmed that their transaction references do not match Talk Space references and do not appear in the admin payment ledger. Raw customer codes are intentionally not stored here. This classifies those examples as provider-only for the current investigation, pending a complete export/reconciliation. Key rotation has been performed; the remaining evidence item is confirmation that the old keys are rejected and that obsolete payment links/checkout pages are disabled.

The legacy-link inventory in [`PAYSTACK_LEGACY_LINK_INVENTORY_2026-10-12.md`](./PAYSTACK_LEGACY_LINK_INVENTORY_2026-10-12.md) must be reconciled against the provider export before any content is removed or rewritten.

## Evidence handling rules

- Never commit `.env` values, access tokens, provider secrets, card data, or full authorization headers.
- Keep raw provider exports in an access-controlled incident location, not in this repository.
- Hash or redact customer identifiers in exported evidence where practical.
- Preserve original timestamps and transaction references for reconciliation.
- Do not delete, overwrite, refund, or restore data solely from the screenshots.

Related documents:

- [`PAYSTACK_PAYMENT_ABUSE_HARDENING_CHECKLIST_2026-10-12.md`](./PAYSTACK_PAYMENT_ABUSE_HARDENING_CHECKLIST_2026-10-12.md)
- [`PAYSTACK_PAYMENT_ABUSE_RESPONSE_RUNBOOK.md`](./PAYSTACK_PAYMENT_ABUSE_RESPONSE_RUNBOOK.md)
