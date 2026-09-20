# Supabase egress reduction and quota protection plan

Created: 13 September 2026. Status: planning only; no fixes or billing changes applied.
Documentation branch: `docs/supabase-egress-reduction-plan`, based on `develop`.
Operational tracking: [Free-plan maintenance checklist](SUPABASE_FREE_PLAN_MAINTENANCE_CHECKLIST.md).
Reported grace-period deadline: **13 October 2026**. Confirm the exact cutoff in
the organization dashboard; do not assume this is the billing-cycle reset date.

## Objective and boundaries

Keep projected usage below 80% of each applicable organization quota while
preserving booking, payment, therapist access, CMS edits and client privacy.
This is a proposed operating target, not a guarantee against traffic spikes or
provider restrictions. The supplied dashboard screenshot confirms Free plan;
actual egress usage, reset date and cause remain unverified.

Egress is outbound data, not just the amount stored. Cached and uncached egress
have separate allowances; traffic from all organization projects matters. The
current published allowances are 5 GB uncached plus 5 GB cached on Free, and
250 GB each on Pro. Confirm the dashboard entitlement before budgeting. Already
incurred egress cannot be removed by deleting files or optimizing future traffic.
See [Supabase egress guidance](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

A warning can persist after usage improves; do not assume a fresh grace period
will be granted. Usage-based restrictions may require a cycle reset or an
approved billing change to lift. Do not wait until the deadline to investigate.
See [Fair Use and billing guidance](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).

Non-negotiable safeguards:

- No deletion of existing images, content, bookings or client records to reset usage.
- No replacement of admin-selected pictures with stock/fallback assets.
- No shared caching of client records, notes, tokens, auth responses or payments.
- No stale cached availability as the final authority for booking confirmation.
- No disabling payment webhooks, reconciliation or essential session reminders.
- No upgrading, disabling Spend Cap, moving data, or adding paid services without approval.
- Preserve originals and URL mappings when generating image variants; provide rollback.

## Evidence needed first

The owner should provide redacted screenshots or reports from Organization > Usage
and Billing. Never share service-role keys, tokens or client details.

| Measurement                                    | Value to record                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Organization plan and Spend Cap                | Free plan confirmed by supplied screenshot; no billing changes authorized       |
| Current billing start/reset and grace deadline | Grace deadline 13 October 2026 confirmed by banner; billing start/reset pending |
| Cached egress allowance / used / daily trend   | Pending                                                                         |
| Uncached egress allowance / used / daily trend | Pending                                                                         |
| Prior cycle totals and current last 7 days     | Pending                                                                         |
| Per-project and per-service breakdown          | Storage, Database, Auth, Realtime, Functions, pooler, drains                    |
| Public traffic and top downloaded assets       | Requests, bytes, cache status; exclude private URLs from evidence               |
| Other quotas                                   | Storage, database size, transformations, function invocations, Realtime, MAU    |

### Screenshot evidence received on 13 September

- Organization: Ebeya Technologies; project: Talk Space, production branch.
- Project status: Healthy. Banner reports previous-cycle quota overage and
  possible restrictions from 13 October 2026 if the organization remains over quota.
- Selected interval: last 60 minutes. Total requests: 2,193; success rate: 99.7%.
- API Gateway: 1,810 requests, 7 errors. Auth: 369 requests. Storage: 8 requests.
- These counts do not establish monthly egress, bytes per request, the affected
  allowance, or the largest source. Do not extrapolate this hour into a monthly
  bandwidth total or conclude images are insignificant from the Storage count.
- Investigate repeated API/Auth calls only after identifying endpoints and
  callers; routine sessions, dashboard activity and development traffic may
  contribute. No excessive polling or abuse is proven by this screenshot.
- Next evidence: click the banner's **Review usage** link; capture both current
  and previous billing cycles, cached/uncached GB, service/project breakdown,
  and cycle dates. Start with all projects, then filter to Talk Space.

EG-01 remains incomplete until that usage baseline is available.

Use bounded log samples and metadata listings first. Do not download the entire
media library or repeatedly crawl production to investigate a bandwidth problem.
Request counts multiplied by object sizes are estimates, not exact billing data.
Supabase documents storage traffic analysis in its
[bandwidth guide](https://supabase.com/docs/guides/storage/serving/bandwidth).

## Findings from the code, not a proven root cause

| Location                                     | Observed behavior                                                                                     | Investigation / planned treatment                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/site/OptimizedImage.tsx`     | Responsive transform URLs already exist, including signed-path rewriting.                             | Verify actual downloaded size, `sizes`, plan eligibility and private transformation signing. Do not simply add more transforms. |
| `src/components/admin/MediaUploadInput.tsx`  | Unique upload paths, `upsert: false`, one-year cache lifetime.                                        | Reuse safe versioned assets; verify uploaded dimensions and encoding.                                                           |
| `src/routes/_authenticated.admin.media.tsx`  | Upload paths use one-hour cache lifetime.                                                             | Establish a consistent policy for immutable public images, without stale CMS replacements.                                      |
| `src/lib/content.functions.ts`               | Many public reads use `no-store`; homepage has an in-process cache and reads latest-post `body_html`. | Measure response size, hit rate and repeated reads. Confirm whether full post bodies are needed for homepage cards.             |
| `src/routes/_authenticated.admin.google.tsx` | Expanded activity refreshes every 30 seconds.                                                         | Measure payload/calls; pause hidden-tab refresh and prevent overlapping requests if warranted.                                  |
| `scripts/audit-*.mjs`, previews and imports  | These can generate real traffic when pointed at production.                                           | Bound scans, prefer synthetic/local fixtures and separate staging configuration.                                                |

Supabase image resizing currently requires Pro or above. Signed transformation
parameters must be included when signing, not freely changed afterward. If the
plan cannot transform images, generate stored display variants during upload
instead of pointing browsers at unsupported endpoints. See
[image transformation documentation](https://supabase.com/docs/guides/storage/serving/image-transformations).

## Budget and alerts

Calculate separately for cached and uncached traffic, using the dashboard's units:

```text
Q = cycle allowance
U = usage already recorded in this cycle
D = remaining days in the billing cycle, minimum 1
target = 0.80 * Q
remaining_daily_budget = max(0, target - U) / D
forecast = U + max(last_3_day_average, last_7_day_average) * D
```

For illustration only: Q = 5 GB, U = 2 GB and D = 20 gives a 0.1 GB/day budget
to finish at 4 GB. Calculate the other egress allowance independently. A zero
remaining budget means the target is already spent, not that optimization will
reset it. Include staging and all other projects in these calculations.

- Target: forecast at or below 80% of each quota; retain 20% headroom.
- Watch: 50% consumed or a daily spike above twice the recent average; investigate.
- Action: 70% consumed or forecast above 80%; assign an owner the same day.
- Escalation: 85% consumed or forecast above 100%; activate approved contingency.
- Critical: 95% consumed or any 402; incident response immediately, not another scan.

Start with a daily owner check. Automate lightweight alerts only using supported
metrics/access available on this plan, with an out-of-band notification channel.
These are internal thresholds, not a claim that Supabase provides configurable
alerts at each level. Track other quotas too so image variants or cache storage
do not merely move the overage to a different resource.

## Implementation batches

All items below are **Not Started**. Each future branch starts from current
`develop` as `feature/egress-<batch>-<name>`. Prioritize by measured contribution;
do not assume images are the largest source until EG-01 completes.

| ID    | Priority / owner       | Work                                                                                                                                          | Acceptance and evidence                                                                                                                                                              |
| ----- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EG-01 | P0 / owner + engineer  | Confirm plan, cycle, per-project/service totals and top traffic sources.                                                                      | Baseline report with both forecasts, largest contributors and investigation limits.                                                                                                  |
| EG-02 | P0 / engineer          | Remove confirmed unnecessary downloads, repeated exports and production-backed test traffic; investigate abusive access.                      | Bounded before/after request counts; critical booking jobs remain enabled.                                                                                                           |
| EG-03 | P1 / engineer          | Generate appropriately sized public media variants, constrain upload dimensions/bytes, reuse existing crop pipeline and responsive component. | Proposed display budgets: thumbnails <= 60 KB, cards <= 120 KB, mobile hero <= 200 KB; exceptions documented after visual review. No quality/crop regressions.                       |
| EG-04 | P1 / engineer          | Standardize immutable public-image cache headers and stable versioned URLs. Keep originals and reference manifest.                            | Second normal visit reuses browser cache; a replacement image appears after publish without waiting out the old image TTL.                                                           |
| EG-05 | P1 / engineer          | Cache explicitly public published-content data and deduplicate concurrent cache misses. Retain uncached authenticated editor previews.        | Prototype 60-300 second TTL, publish invalidation and multi-instance behavior; public edits visible within agreed maximum 60 seconds. No user-specific data enters shared cache.     |
| EG-06 | P1 / engineer          | Select only needed columns, paginate media/admin lists, fetch details on demand, debounce searches and bound exports.                         | Equivalent rows/actions; lower bytes per measured endpoint; no truncated exports or missing client records.                                                                          |
| EG-07 | P1 / engineer          | Deduplicate polling, avoid hidden-tab/background fetches and apply bounded retry/backoff to transient reads.                                  | Hidden-tab request count drops; visible status remains accurate; no extra Google/Paystack calls or duplicate mutations.                                                              |
| EG-08 | P0 / engineer          | Handle provider quota failures and protect payment continuity.                                                                                | Inject 402 on staging: useful unavailable state, no retry storm, no duplicate checkout. Durable failed-webhook recovery and provider reconciliation are demonstrated before release. |
| EG-09 | P1 / owner + engineer  | Establish daily forecasts, external uptime checks and threshold ownership.                                                                    | Simulated threshold/402 alerts reach owner without relying on the restricted database. Monitor requests are small and budgeted.                                                      |
| EG-10 | P1 / engineer + tester | Run regression, image and quota UAT for each batch.                                                                                           | Desktop/mobile screenshots, cache/network evidence, same-workload byte comparison and 7-day usage trend; approved PR to develop.                                                     |
| EG-11 | P0 / owner             | Decide contingency if legitimate traffic cannot fit the current allowance.                                                                    | By 6 October, approve further scope reduction, a costed public-media hosting change, or a plan change; no silent billing changes.                                                    |

Caching decisions must account for where the cache lives. A Supabase CDN hit
still consumes cached egress. Browser cache reuse can avoid a new download;
an application cache can avoid repeated database reads. A public-media CDN or
hosting migration is a separate option only if measurements justify it: compare
all provider allowances, origin misses, cache eviction, invalidation, migration
egress, storage cost and rollback. It is not unlimited or free bandwidth.
See [Supabase Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals).

Do not apply blanket HTTP caching to the application shell: it can contain auth
state. Prefer a public-data-only cache with reviewed serialization and keys.
An in-process cache alone is not guaranteed to survive serverless cold starts or
invalidate across replicas. Do not cache permission denials or provider failures
as successful public data. Clinical/private storage remains access-controlled.

## Schedule and release gates

1. Within 48 hours: EG-01 baseline, EG-02 immediate containment and forecast.
2. By 22 September: highest-impact measured image/query batch in staging;
   EG-08 failure handling designed and tested with simulated responses.
3. By 29 September: remaining justified optimizations and alerts verified;
   approved changes promoted through the normal staging/UAT release process.
4. By 6 October: review at least seven days of usage, forecast both quotas and
   make the EG-11 capacity decision. Escalate earlier if a threshold is crossed.
5. By 10 October: verify contingency, recovery contacts and billing state. Do not
   depend on finishing remediation on 13 October.
6. Continue daily checks through the deadline and weekly checks over at least
   two complete billing cycles. A lower one-day number is not proof of stability.

Every implementation batch requires lint, typecheck, relevant automated tests,
build, staging evidence, owner sign-off and a reviewed PR to `develop`. Promotion
to `main` remains a separate approved release PR. Coordinate with feedback PR
#152 and MP-001; do not inadvertently deploy its unfinished booking changes.

## UAT and incident checklist

- [ ] Compare cold and warm mobile/desktop visits to home, pricing, therapists,
      journal and booking with a fixed small test set. Record transferred bytes and
      selected image dimensions; Lighthouse score alone does not measure billed egress.
- [ ] Verify original images, crop/alt text, public URLs and admin edits survive.
- [ ] Publish a content/image edit, then test anonymous and authenticated views
      in separate browsers and deployment instances; record freshness delay.
- [ ] Confirm private client/therapist responses are never served across users.
- [ ] Confirm simultaneous booking/payment integrity and live availability remain
      correct; reused public content must not turn stale slots into confirmed bookings.
- [ ] Inject 402 without consuming real quotas: auth, public content, storage,
      admin data and payment callback fail gracefully with bounded requests.
- [ ] During a simulated database outage, do not acknowledge an unpersisted
      webhook as successfully processed. Test the actual provider retry behavior,
      independent alerting and idempotent reconciliation after recovery.
- [ ] Verify an unavailable booking backend cannot start a checkout it cannot
      record; distinguish already-paid clients from unpaid clients in recovery UI.
- [ ] Show seven-day before/after usage normalized for visits and admin activity;
      both forecasts <= 80%, no newly exceeded quota, no functionality regression.
- [ ] Document rollback per batch: restore prior asset references/cache policy
      without deleting originals or losing payment events.

If 402 occurs: notify the owner through an independent channel, stop nonessential
fetch loops, keep already-paid clients from paying again, inspect provider status
and billing, and coordinate recovery with Supabase support. Only the owner can
approve a paid capacity change. Test recovery and reconcile pending payments
before announcing service restored. Do not promise that removing files clears a
restriction. [Supabase HTTP status guidance](https://supabase.com/docs/guides/troubleshooting/http-status-codes)

## Completion record

For each EG item capture: branch/commit, owner, baseline, implementation, automated
results, staging URL, redacted evidence, actual savings, quota forecast and rollback.
Move through Not Started -> In Progress -> Ready for UAT -> UAT Passed ->
Production Ready -> Done only when the corresponding evidence exists.

This document has only been reviewed against local code and official provider
documentation. Organization usage, restriction state, savings and production
readiness have not been independently verified.
