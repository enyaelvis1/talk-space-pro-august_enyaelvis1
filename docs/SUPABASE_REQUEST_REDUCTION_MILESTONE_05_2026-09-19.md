# Supabase Request Reduction Milestone 5

## Measurement and operating controls

Status: **Implemented locally; ready for review/UAT**

This milestone adds an executable evaluator for redacted Supabase usage
snapshots. It keeps cached and uncached egress separate, projects each metric
to the end of the billing period, and assigns internal escalation levels at
50%, 70%, 85%, and 95% of each independent allowance.

The evaluator does not call Supabase, read `.env` files, or contain provider
credentials. Export the values manually from the Supabase usage dashboard,
redact project identifiers if the report is shared, and run:

```bash
npm run usage:report -- docs/usage/supabase-usage-2026-09-19.json
```

Input format:

```json
{
  "capturedAt": "2026-09-19T12:00:00.000Z",
  "periodStart": "2026-09-01T00:00:00.000Z",
  "periodEnd": "2026-10-01T00:00:00.000Z",
  "cachedEgressBytes": 0,
  "uncachedEgressBytes": 0,
  "cachedEgressLimitBytes": 5368709120,
  "uncachedEgressLimitBytes": 5368709120,
  "apiRequests": 0
}
```

Do not add credentials, access tokens, project secrets, client records, or
request payloads to usage snapshots.

### Seven-day operating procedure

Record one snapshot at the same local time each day for seven consecutive
days. Capture cached egress, uncached egress, API gateway requests, Auth,
Storage, Postgres, Edge Functions, the selected dashboard window, and any
quota warnings. Keep the raw dashboard evidence restricted and commit only
the redacted summary if a repository record is needed.

- **Below 50%:** normal monitoring.
- **50% to below 70%:** observe the trend and inspect the largest request
  source.
- **70% to below 85%:** schedule corrective work and increase review cadence.
- **85% to below 95%:** owner and engineering review required; pause optional
  staging traffic if necessary.
- **95% or above:** treat as critical; stop non-essential traffic and decide
  on scope reduction or capacity before the billing restriction deadline.

Cached and uncached allowances are independent. Never add their bytes
together, and never treat API request counts as an egress measurement.

### Acceptance gates

- [x] Current usage is classified independently for cached and uncached egress.
- [x] End-of-period projections and escalation thresholds are executable.
- [x] Invalid or zero limits fail closed.
- [x] The report path requires no secrets or remote mutations.
- [ ] Seven days of real dashboard evidence are recorded.
- [ ] Owner reviews the forecast against the Free-plan restriction deadline.
- [ ] Cached and uncached projections are each at or below the approved target.

### Release boundary

This branch targets `develop` only. UAT must run the report with a redacted
staging snapshot and compare its output with the Supabase dashboard. Real
organization usage remains an external operational check and is not claimed
by automated tests.
