# Talk Space — Paystack Payment Abuse Response Runbook

Date: 2026-10-12
Scope: production payment operations; execute only by the payment/account owner

## Immediate containment

1. Preserve the Paystack export, application payment records, Vercel request logs, and Supabase security/audit logs before changing provider settings.
2. Compare provider references with `public.payments.reference` and `provider_reference`. Classify each transaction as application-linked, legacy-linked, or provider-only.
3. If active card testing is confirmed, disable live Paystack checkout from the admin payment settings while leaving existing records and bank-transfer review available.
4. Rotate the Paystack secret and webhook secret when exposure cannot be ruled out. Update the deployment secret store only; never place replacements in source control or screenshots.
5. Ask Paystack support to review the burst, card fingerprints, IPs, and account/payment-link sources. Keep the support case ID with the incident evidence.

For offline reconciliation, keep the raw exports in a protected location and run:

```bash
npm run security:reconcile-paystack -- \
  --provider-csv /protected/path/paystack-export.csv \
  --application-csv /protected/path/application-payments.csv \
  --output /protected/path/paystack-reconciliation-report.json
```

The report hashes references, emails, and IPs; classifies application-linked/provider-only/missing-reference rows; and flags configurable activity bursts. It does not call a provider, write to Supabase, send alerts, or include raw identifiers.

## Provider-side control review

Record the current value and change owner for each item in the Paystack dashboard:

- live/test mode and active merchant account;
- public and secret key ownership and last-rotation time;
- payment links, checkout pages, and old domains;
- available velocity, fraud, blocked-card, blocked-IP, and customer controls;
- enabled payment channels and whether card-only checkout is necessary;
- dashboard members, roles, login history, and notification recipients;
- webhook URL, signing secret, delivery history, retries, and failed deliveries.

Do not blacklist a customer, card, or IP solely from a heuristic. Require a transaction export and an owner-approved reason.

## Detection thresholds

Start with alerts that are easy to tune and do not contain raw card data:

| Signal | Initial threshold | Action |
|---|---:|---|
| Payment initializations from one request-identity hash | 5 in 15 minutes | Block by limiter and review |
| Payment initializations for one normalized email | 3 in 60 minutes | Block by limiter and review |
| Low-value Paystack successes | 10 in 15 minutes or 25 in 1 hour | Page payment operations |
| Provider references with no application match | Any burst of 3 in 15 minutes | Reconcile and inspect legacy links |
| Paystack failures for one identity/email | 10 in 15 minutes | Review for card testing |
| Payment webhook signature failures | 3 in 10 minutes | Review secret/configuration and source |

Tune thresholds after seven days of normal traffic. Alerts must include only hashed identities, route, counts, timestamps, status, and redacted references.

## Refund and chargeback review

For every suspicious successful transaction:

1. Preserve the provider reference, application match result, payment status timeline, and customer communication history.
2. Confirm whether Talk Space delivered a booking, package credit, or no value.
3. If application-linked, place the booking/package in an admin review state without deleting the payment record.
4. Obtain payment-operations approval before refunding. Record the provider refund reference and reason.
5. If provider-only, do not invent an application booking. Ask the Paystack account owner to handle the provider transaction.
6. Reconcile refunds and chargebacks against the accounting ledger and retain evidence according to the organisation's retention policy.

Never auto-refund solely because an amount is low or an email looks automated.

## UAT evidence required

- blocked burst with no provider initialization;
- limiter outage blocks live initialization;
- valid, invalid, replayed, and malformed webhook deliveries;
- wrong amount, currency, and reference rejection;
- provider-only reference rejected without fulfillment;
- redacted security events visible to an admin;
- a sandbox/test refund rehearsal with no production mutation.

## Outstanding external evidence

The provider export, Paystack dashboard screenshots, support case, Vercel log export, and Supabase production audit export must be supplied by the account/platform owners. This runbook does not authorize access, credential rotation, provider changes, deployment, or production data mutation.
