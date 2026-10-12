# Talk Space — Paystack Payment Abuse and Card-Testing Hardening Checklist

Date created: 2026-10-12
Environment in scope: production Paystack integration and staging/local validation
Status: Investigation complete; remediation pending

## Incident summary

Paystack screenshots show a high volume of low-value card transactions with changing customer emails and repeated requested amounts. This pattern is consistent with automated card testing, but the evidence does not yet prove that an attacker accessed the Talk Space admin panel, Supabase, or Vercel.

The visible references do not match the application’s normal `TSP-...` reference format. This may indicate that the transactions were created directly through a Paystack public key, an old Paystack payment link, another integration, or a compromised secret key. This must be confirmed against the Paystack export, application payment records, and provider/server logs.

Do not delete transactions, payment records, audit events, or logs during this investigation.

## Priority and status legend

- P0 — contain active financial abuse or prevent false confirmation.
- P1 — close an exploitable application path and add detection.
- P2 — improve resilience, reporting, and operational controls.
- Status values: Open / In Progress / Ready for UAT / UAT Passed / Production Ready / Done.

## Milestone 1 — Containment and evidence preservation

- [ ] ID: PAY-ABUSE-001
  Priority: P0
  Area: Incident containment
  Summary: Determine whether low-value Paystack transactions are still arriving.
  Required action: Review the Paystack live transaction feed and application logs for the current period. If abuse is active, temporarily disable live Paystack checkout while preserving bank-transfer and existing booking operations.
  Owner / role: Admin owner / payment operations
  Environment: production
  Current status: Open
  Evidence required: Paystack transaction export, timestamp range, transaction count, and screenshot of current payment settings.
  Notes / blocker: The provider customer screenshot is evidence to preserve, not evidence of Talk Space client creation. Do not delete or manually mark transactions as successful or failed during containment.

- [ ] ID: PAY-ABUSE-002
  Priority: P0
  Area: Provider evidence
  Summary: Preserve the Paystack transaction evidence before refunds, blacklisting, or key rotation.
  Required action: Export CSV/API records including reference, status, amount, requested amount, fees, customer email, IP, card fingerprint/authorization where Paystack permits, gateway response, channel, and created/paid timestamps.
  Owner / role: Admin owner / Paystack account owner
  Environment: production
  Current status: Open
  Evidence required: Protected export location and checksum; no secrets in the repository or chat.
  Notes / blocker: Redact card data beyond Paystack’s permitted masked fields.

- [ ] ID: PAY-ABUSE-003
  Priority: P0
  Area: Credential containment
  Summary: Determine whether the Paystack secret or webhook secret may have been exposed.
  Required action: Review Vercel environment-variable access, deployment history, source-control history, local secret handling, admin audit events, and Paystack key activity. Rotate the live secret and webhook secret if exposure cannot be ruled out.
  Owner / role: Technical owner / security owner
  Environment: production
  Current status: In Progress
  Evidence required: Rotation timestamp, affected deployment IDs, and confirmation that old credentials no longer work.
  Notes / blocker: Key rotation has been performed. Confirm the old keys are rejected and record only the rotation timestamp/deployment evidence; never place replacement keys in source control, screenshots, or this checklist.

- [ ] ID: PAY-ABUSE-004
  Priority: P0
  Area: Payment links and channels
  Summary: Identify public Paystack links or legacy integrations that may bypass the current booking flow.
  Required action: Inventory Paystack payment links, old `paystack.com/buy/...` links, marketing content, CMS content, old domains, and any third-party forms. Disable or replace obsolete links.
  Owner / role: Admin owner / web owner
  Environment: production
  Current status: Open
  Evidence required: Link inventory with owner, purpose, amount, status, and removal/replacement evidence.
  Notes / blocker: Inventory is captured in [`PAYSTACK_LEGACY_LINK_INVENTORY_2026-10-12.md`](./PAYSTACK_LEGACY_LINK_INVENTORY_2026-10-12.md). Keep required production links available only if their amount and purpose are verified; retirement still requires provider reconciliation and service mapping.

## Milestone 2 — Transaction attribution and fraud diagnosis

- [ ] ID: PAY-ABUSE-005
  Priority: P0
  Area: Reconciliation
  Summary: Determine whether the suspicious Paystack transactions entered the Talk Space application.
  Required action: Match every provider reference against `public.payments.reference` and `provider_reference`, then classify as application-linked, legacy-linked, or provider-only.
  Owner / role: Backend engineer / payment operations
  Environment: production
  Current status: In Progress
  Evidence required: Reconciliation report containing counts and non-sensitive reference hashes or redacted references.
  Notes / blocker: Two supplied Paystack customer examples were checked by the account owner: their transaction references do not match Talk Space references and do not appear in the admin ledger, so they are classified as provider-only examples. The offline `security:reconcile-paystack` utility still requires the complete protected exports for final counts; do not expose customer card information in the report.

- [ ] ID: PAY-ABUSE-006
  Priority: P0
  Area: Request tracing
  Summary: Identify whether the transactions originated from the public site or a direct Paystack integration.
  Required action: Correlate Paystack timestamps with Vercel request logs, payment initialization calls, callback requests, webhook requests, Supabase payment inserts, and admin actions.
  Owner / role: Backend engineer / platform owner
  Environment: production
  Current status: In Progress
  Evidence required: Redacted timeline showing request path, status, user-agent class, source IP hash, reference prefix, and database result.
  Notes / blocker: Preserve raw provider and platform exports privately; only link redacted evidence here. The offline reconciliation utility provides the application/provider reference comparison once those exports are supplied.

- [ ] ID: PAY-ABUSE-007
  Priority: P1
  Area: Admin access review
  Summary: Rule out compromised admin or Supabase access.
  Required action: Review Supabase auth/audit logs, admin audit logs, Vercel deployment activity, GitHub access, Paystack dashboard members, and recent secret changes.
  Owner / role: Security owner
  Environment: production
  Current status: Open
  Evidence required: Access review with unexpected sessions, IP/country anomalies, role changes, and secret changes.
  Notes / blocker: Revoke unknown sessions and members after evidence is preserved.

## Milestone 3 — Application abuse controls

- [ ] ID: PAY-ABUSE-008
  Priority: P0
  Area: Paystack initialization
  Summary: Prevent unlimited public creation of Paystack transactions.
  Required action: Add server-side rate limits to `initPaystackPayment` and `initPackagePurchasePayment`, keyed by trusted request identity plus normalized email and booking/package context. Return a controlled retry response.
  Owner / role: Backend engineer
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Unit tests for limits, burst tests, and logs showing blocked requests without creating provider transactions.
  Notes / blocker: IP and normalized-email buckets are implemented for both public initialization paths. Local contract tests pass; UAT burst testing and provider-side confirmation remain outstanding. Do not rely on a client-side limit.

- [ ] ID: PAY-ABUSE-009
  Priority: P0
  Area: Checkout eligibility
  Summary: Prevent package-payment initialization for arbitrary, unbound customer data.
  Required action: Require a valid authenticated client, valid booking/manage token, or server-issued package checkout token. Validate that the service, session count, price, email, and client/package relationship are consistent before contacting Paystack.
  Owner / role: Backend engineer / product owner
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Negative tests for arbitrary email/service combinations and positive tests for guest checkout requirements.
  Notes / blocker: Package payment initialization now requires an authenticated account, binds any supplied client ID to that account, and requires the checkout email to match the signed-in account. Local negative/positive contract coverage passes. A bounded guest package-checkout token remains a product decision if guest package purchases must be supported.

- [ ] ID: PAY-ABUSE-010
  Priority: P1
  Area: Bot mitigation
  Summary: Make automated payment initialization expensive to abuse.
  Required action: Add CAPTCHA/Turnstile or equivalent risk challenge before live payment initialization when risk signals exceed thresholds. Add minimum time-on-form and repeated-email/device checks where appropriate.
  Owner / role: Frontend and backend engineers
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Browser UAT, bot/burst test, accessibility review, and proof that legitimate payment remains usable.
  Notes / blocker: Optional Cloudflare Turnstile is wired into appointment and package payment initialization. Local contract coverage passes. Configure matching `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the deployment environment to activate it; provider/browser UAT remains outstanding. Do not challenge trusted admin recovery flows unnecessarily.

- [ ] ID: PAY-ABUSE-011
  Priority: P1
  Area: Rate-limit reliability
  Summary: Prevent payment abuse when the rate-limit service fails.
  Required action: Change payment-initialization rate limiting from fail-open to fail-closed or a tightly bounded emergency budget. Add an alert when limiter calls fail.
  Owner / role: Backend engineer / platform owner
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Failure-injection test showing that provider initialization is blocked when the limiter is unavailable.
  Notes / blocker: Payment initialization now fails closed when the database limiter is unavailable and records a critical security event. Failure-injection UAT remains outstanding; apply the stricter behavior only to payment initialization and other financially sensitive actions.

- [ ] ID: PAY-ABUSE-012
  Priority: P1
  Area: Trusted client identity
  Summary: Prevent spoofed `x-forwarded-for` values from bypassing IP-based controls.
  Required action: Use the hosting platform’s trusted request-IP source, or explicitly normalize trusted proxy headers before hashing the identifier.
  Owner / role: Platform engineer
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Proxy/spoofing tests and documented trusted-header behavior on Vercel.
  Notes / blocker: Request identity now prefers Vercel's `x-real-ip` and only falls back to `x-forwarded-for`; only hashed identifiers are sent to the security-event logger. Confirm the trusted-header behavior on the deployed platform.

## Milestone 4 — Payment integrity and provider controls

- [ ] ID: PAY-ABUSE-013
  Priority: P0
  Area: Payment verification
  Summary: Ensure only verified, correctly matched Paystack payments deliver value.
  Required action: Preserve server-side checks for status, amount in minor units, currency, provider reference, checkout ownership, and idempotent fulfillment. Reject unmatched or provider-only references.
  Owner / role: Backend engineer
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Tests for wrong amount, wrong currency, wrong reference, success replay, failed replay, and provider-only reference.
  Notes / blocker: Existing server-side validation checks minor-unit amount, provider-requested amount/fees, currency, and reference before fulfillment. Never confirm from a browser success callback alone.

- [ ] ID: PAY-ABUSE-014
  Priority: P0
  Area: Webhook security
  Summary: Preserve Paystack webhook authenticity and replay safety.
  Required action: Verify HMAC signature over the raw body, re-verify the transaction with Paystack, enforce idempotency, and record webhook event identifiers/status transitions.
  Owner / role: Backend engineer
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Valid signature, invalid signature, replay, duplicate delivery, and malformed payload tests.
  Notes / blocker: Webhook processing validates the raw-body HMAC, re-verifies with Paystack, uses the idempotent payment-status RPC, and records redacted processing events. Follow Paystack's webhook retry behavior and acknowledge safely.

- [ ] ID: PAY-ABUSE-015
  Priority: P1
  Area: Paystack account controls
  Summary: Reduce provider-side card-testing exposure.
  Required action: Review available Paystack fraud controls, velocity limits, blocked customers/cards/IPs, allowed channels, payment links, and support escalation options.
  Owner / role: Paystack account owner
  Environment: production
  Current status: Open
  Evidence required: Provider configuration screenshots and support case/reference.
  Notes / blocker: Operational steps are documented in `docs/PAYSTACK_PAYMENT_ABUSE_RESPONSE_RUNBOOK.md`; Paystack dashboard review and support escalation require the account owner.

## Milestone 5 — Monitoring and operational response

- [ ] ID: PAY-ABUSE-016
  Priority: P1
  Area: Detection
  Summary: Detect payment abuse before it becomes a large transaction burst.
  Required action: Alert on low-value transaction spikes, repeated email churn, high failure ratios, unmatched provider references, repeated IP/device hashes, and unusual initialization volume.
  Owner / role: Platform engineer / payment operations
  Environment: production
  Current status: In Progress
  Evidence required: Alert rules, thresholds, test alert, and escalation owner.
  Notes / blocker: Initial thresholds and redacted alert fields are documented in `docs/PAYSTACK_PAYMENT_ABUSE_RESPONSE_RUNBOOK.md`. The offline reconciliation utility now detects configurable low-value-success, provider-only, repeated-email, and repeated-IP bursts; production alert wiring and a test alert remain external work.

- [ ] ID: PAY-ABUSE-017
  Priority: P1
  Area: Auditability
  Summary: Make every payment initialization and verification attributable.
  Required action: Record a redacted audit event for request identity hash, route, booking/package ID, amount, currency, provider reference, result, and reason.
  Owner / role: Backend engineer / security owner
  Environment: staging / production
  Current status: Ready for UAT
  Evidence required: Audit records for allowed, blocked, mismatched, and replayed flows.
  Notes / blocker: Payment initialization and webhook processing now emit redacted security events with hashed request/reference identifiers, route, amount, currency, result, and status. Do not log Paystack secret values, full payment details, or raw tokens.

- [ ] ID: PAY-ABUSE-018
  Priority: P2
  Area: Refund and chargeback operations
  Summary: Define how successful suspicious transactions are handled without corrupting booking records.
  Required action: Document refund/chargeback review, customer communication, booking linkage, accounting reconciliation, and evidence retention.
  Owner / role: Admin owner / finance / payment operations
  Environment: production
  Current status: Open
  Evidence required: Approved runbook and one sandbox/test rehearsal.
  Notes / blocker: Refund/chargeback review and evidence-retention steps are documented in `docs/PAYSTACK_PAYMENT_ABUSE_RESPONSE_RUNBOOK.md`; provider sandbox rehearsal and finance approval remain external work.

## Required regression and security tests

- [x] Payment initialization is rate-limited per request identity and normalized email; checkout-specific UAT remains.
- [x] Repeated blocked attempts are rejected before the provider initialization call; provider/database UAT remains.
- [x] Limiter failure blocks live payment initialization.
- [x] Client-controlled amount, currency, service price, session count, and reference are ignored or rejected by server-side calculation/validation.
- [x] A valid payment confirms only the matching booking/package through the existing server reconciliation path.
- [x] A Paystack success for an unknown application reference is not fulfilled by the webhook checkout lookup.
- [x] A valid-looking but incorrectly signed webhook is rejected.
- [x] A valid webhook replay is idempotent through the payment-status RPC and notification claims; provider replay UAT remains.
- [ ] Old payment links and direct public Paystack flows are inventoried and either disabled or explicitly approved. (Inventory captured; retirement/approval remains external.)
- [x] Application security events contain hashed identifiers and redacted payment context for burst investigation.
- [x] No test uses live cards, real client data, real notifications, or production mutations.

Local verification evidence is recorded in [`PAYSTACK_PAYMENT_ABUSE_EVIDENCE_REGISTER_2026-10-12.md`](./PAYSTACK_PAYMENT_ABUSE_EVIDENCE_REGISTER_2026-10-12.md). The complete local suite passes when run with the expected Vite server on port 5173; the few skipped cases require configured disposable credentials or a local database fixture. Generated screenshots are test artifacts and are not part of the security change.

## Evidence register

| Evidence | Location | Status |
|---|---|---|
| Paystack transaction screenshots supplied by client | Conversation attachments | Captured |
| Full source logical export | `/home/enyasystem/.local/share/talkspace-backups/2026-10-12-source-export` | Created; restore paused |
| Backup checksums and handling record | [`PAYSTACK_PAYMENT_ABUSE_EVIDENCE_REGISTER_2026-10-12.md`](./PAYSTACK_PAYMENT_ABUSE_EVIDENCE_REGISTER_2026-10-12.md) | Captured locally; remote restore not performed |
| Legacy/direct Paystack link inventory | [`PAYSTACK_LEGACY_LINK_INVENTORY_2026-10-12.md`](./PAYSTACK_LEGACY_LINK_INVENTORY_2026-10-12.md) | Captured; provider/content reconciliation required |
| Paystack CSV export | Protected local/provider location | Required |
| Vercel request/deployment logs | Protected platform export | Required |
| Supabase auth/platform audit logs | Protected platform export | Required |
| Application-to-provider reconciliation | Secure investigation report | Required |

## Exit criteria before resuming backup restore

- [ ] Paystack evidence export is preserved.
- [ ] Active abuse is contained or explicitly accepted by the account owner.
- [ ] Live Paystack credentials are rotated if exposure cannot be ruled out.
- [ ] Application-linked versus provider-only transactions are classified.
- [ ] The backup checksum is recorded and the restore target is confirmed.
- [ ] No suspicious payment records are deleted or overwritten during migration.

## Current assessment

The strongest current hypothesis is provider-side card testing through a public Paystack surface or legacy payment link, potentially amplified by missing rate limits on public application payment-initialization functions. There is currently no evidence that the attacker obtained admin credentials. This remains unconfirmed until Paystack export, application payment records, and platform logs are reconciled.
