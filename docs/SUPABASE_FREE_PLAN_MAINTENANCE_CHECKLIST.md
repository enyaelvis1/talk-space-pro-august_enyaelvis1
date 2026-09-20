# Supabase Free-plan maintenance checklist

Created: 13 September 2026. Owner: project owner + engineering.
Related: [egress reduction plan](SUPABASE_EGRESS_REDUCTION_PLAN.md).
Scope: planning and operational tracking only. No infrastructure, application,
billing or production-data changes are authorized by this checklist.

## Outcome and status rules

Keep Talk Space within the Free plan with measurable headroom, without losing
content, client data, payment integrity or essential functionality. This cannot
guarantee unlimited growth or uninterrupted service on a finite free allowance.
If required usage cannot fit, report the capacity gap and obtain an owner decision.

- `[ ]` means not verified complete, including features already present in code.
- `[x]` requires evidence; implementation alone is not a production/UAT pass.
- P0: baseline, compatibility, safety or restriction risk. P1: resource reduction.
- Owners: **Owner** supplies dashboard evidence/approvals; **Eng** implements;
  **QA** verifies staging behavior. Record names before work begins.
- Grace deadline: **13 October 2026**. Capacity decision checkpoint: **6 October**.
  Confirm the billing reset separately; do not treat the deadline as a reset date.

## Free-plan resource budget

Published allowances checked against [Supabase pricing](https://supabase.com/pricing).
The target column is our proposed 80% operating budget, not a provider quota.
Confirm organization/project scope and actual usage in the dashboard. Shared
allowances must account for all organization projects, including staging.

| Resource                  | Published Free allowance        | Operating target         | Actual usage |
| ------------------------- | ------------------------------- | ------------------------ | ------------ |
| Uncached egress           | 5 GB per billing cycle          | <= 4 GB projected        | Pending      |
| Cached egress             | Separate 5 GB per billing cycle | <= 4 GB projected        | Pending      |
| File storage              | 1 GB                            | <= 800 MB                | Pending      |
| Database size             | 500 MB per project              | <= 400 MB per project    | Pending      |
| Monthly active users      | 50,000                          | <= 40,000 projected      | Pending      |
| Edge Function invocations | 500,000 per cycle               | <= 400,000 projected     | Pending      |
| Realtime messages         | 2 million per cycle             | <= 1.6 million projected | Pending      |
| Realtime peak connections | 200                             | <= 160                   | Pending      |

Track CPU, RAM, database connections, latency and errors separately: their health
cannot be inferred from the egress budget or API request count. Distinguish
Supabase Edge Functions from application functions running on another host.
API request volume alone is not a bandwidth allowance. Do not combine the two
egress budgets into an interchangeable 10 GB pool.

Free does not include on-demand image transformations, automatic backups or an
uptime SLA. It includes Basic CDN, not Smart CDN, and can pause inactive projects
after a week. Do not depend on unavailable paid features or create artificial
traffic to evade inactivity policies. See [plan comparison](https://supabase.com/pricing).

## A. Establish the baseline first

- [x] **FP-01 / P0 / Owner:** Confirm the Free plan and grace deadline.
      Evidence: supplied dashboard screenshot shows Free, Healthy, and 13 October 2026.
      This does not establish that current-cycle usage is under quota.
- [ ] **FP-02 / P0 / Owner:** Capture current/previous cycle dates and every
      budget-table value from Organization > Usage. Include all projects, then Talk
      Space alone. Evidence: redacted screenshots and a dated usage sheet.
- [ ] **FP-03 / P0 / Eng:** Identify top bandwidth sources using bounded service,
      endpoint and storage metadata samples. Separate production, dashboard, bot,
      development and test traffic. Evidence: ranked bytes/estimates and confidence;
      do not assume images or Auth dominate from request counts alone.
- [ ] **FP-04 / P0 / Owner + Eng:** Allocate each shared budget across production,
      other projects, staging, monitoring, exports and backup traffic. Calculate daily
      remaining allowances with the formula in the egress plan. Evidence: both egress
      forecasts and a named person responsible for checking them.

## B. Make images and storage Free-compatible

- [ ] **FP-05 / P0 / Eng:** Audit `OptimizedImage.tsx` and its callers against the
      actual Free project. Replace dependencies on unsupported transformation URLs
      with upload-time/pre-generated variants or another explicitly approved path.
      Evidence: valid image responses on Free, correct mobile/desktop variants, and
      no repeated failed-transform/fallback downloads.
- [ ] **FP-06 / P1 / Eng:** Apply consistent dimension, byte and file-type limits
      to all public-image upload paths, including media library and crop editor.
      Proposed delivered budgets: thumbnail <= 60 KB, card <= 120 KB, mobile hero
      <= 200 KB. Document quality exceptions. Evidence: representative visual/byte tests.
- [ ] **FP-07 / P1 / Eng:** Reuse responsive rendering, correct `sizes`, explicit
      dimensions and below-fold lazy loading; prioritize only genuinely above-fold
      images. Evidence: network traces show appropriately sized assets without
      duplicate downloads, blank images or layout shifts.
- [ ] **FP-08 / P1 / Eng:** Standardize long-lived browser caching for immutable
      public media using versioned filenames. Evidence: normal repeat visits reuse
      cache; CMS replacement images appear promptly under a new URL. A Supabase CDN
      hit still consumes cached egress; browser-cache hits can avoid a new request.
- [ ] **FP-09 / P1 / Owner + Eng:** Inventory originals, variants and unused media
      by metadata before migration. Budget all variants inside storage headroom.
      Deduplicate references; delete only demonstrably unreferenced assets after
      approval, retention review and recoverable backup. Evidence: reference manifest
      and rollback. Never replace selected images or clear content automatically.
- [ ] **FP-10 / P1 / Eng:** Paginate media browsing, use thumbnails in pickers,
      and avoid preloading all original files. Evidence: bounded transfers for a
      large library with working search, pagination and image selection.

## C. Reduce public and private data transfers safely

- [ ] **FP-11 / P1 / Eng:** Measure existing homepage aggregation/cache behavior.
      Remove unneeded fields such as full article bodies from card-only responses
      where verified unused. Evidence: lower bytes with identical visible content.
- [ ] **FP-12 / P1 / Eng:** Cache published public data with bounded TTL, request
      deduplication and publish invalidation. Keep editor previews current. Evidence:
      CMS edits visible within the agreed 60-second maximum across instances.
      Do not blanket-cache authenticated HTML or cookie-bearing responses.
- [ ] **FP-13 / P1 / Eng:** Paginate client, appointment, payment and audit lists;
      request details only when opened. Evidence: correct counts, filters, complete
      exports, and lower list payloads without hiding paid bookings.
- [ ] **FP-14 / P1 / Eng:** Pause unnecessary hidden-tab polling, debounce searches,
      avoid overlapping fetches, and deduplicate public reads. Evidence: measured
      request reduction; returning to a tab refreshes required information.
- [ ] **FP-15 / P0 / Eng + QA:** Keep auth, private client data, signed URLs,
      clinical records and payment responses out of shared caches. Keep booking
      commitment checks authoritative and therapist-specific. Evidence: two-user
      isolation and concurrent-booking tests still pass after optimizations.

## D. Control background activity and database growth

- [ ] **FP-16 / P1 / Eng:** Investigate recurring Auth calls and subscription
      lifecycles. Reuse clients, unsubscribe on unmount and avoid duplicate refresh
      loops without weakening server-side authorization. Evidence: request traces
      and login, expiry/logout and therapist-access regression tests.
- [ ] **FP-17 / P1 / Eng:** Scope Realtime subscriptions to authorized records
      and necessary events; remove unused channels and reconnect storms. Evidence:
      bounded connections/messages with no cross-therapist leakage. If unused,
      record that finding rather than introducing Realtime.
- [ ] **FP-18 / P1 / Eng:** Inventory scheduled jobs, Google sync, payment rechecks,
      webhooks and retry policies across hosts. Use bounded batches and backoff for
      transient failures. Evidence: no duplicate runs/events and no reduction in
      required payment reconciliation or session notifications.
- [ ] **FP-19 / P1 / Eng:** Review large tables, indexes, duplicated snapshots,
      slow queries and connection usage. Evidence: database stays under its target
      with acceptable latency; changes do not add indexes indiscriminately or run
      disruptive maintenance on production.
- [ ] **FP-20 / P0 / Owner + Eng:** Approve retention by data category before
      any purge, including drafts, logs and cached external data. Preserve clinical,
      payment, audit and legal retention obligations. Evidence: documented policy,
      dry-run candidate report, recoverability and explicit deletion approval.
- [ ] **FP-21 / P0 / Owner + Eng:** Define acceptable data-loss/recovery windows,
      encrypted off-platform backups and restore drills. Account for backup egress
      and destination limits; avoid unnecessary full re-downloads. Evidence: tested
      restore of database and required storage files without exposing client data.
      Do not assume a database backup includes uploaded objects.
- [ ] **FP-22 / P1 / Eng:** Keep routine tests local/synthetic and bound staging
      scans, exports and Lighthouse runs. Evidence: CI does not create production
      traffic, emails or bookings; staging usage is included in the shared budget.

## E. Prevent restrictions and recover safely

- [ ] **FP-23 / P0 / Owner + Eng:** Establish daily forecasts and manual/available
      lightweight alerts. Watch at 50%; investigate at 70% or a forecast above 80%;
      escalate at 85% or forecast above 100%; treat 95% or any 402 as critical.
      Evidence: a threshold simulation reaches an independent notification channel.
      These are internal thresholds, not assumed built-in Supabase alert features.
- [ ] **FP-24 / P0 / Eng + QA:** Simulate quota-related 402 responses for storage,
      auth, data and booking APIs on staging. Evidence: understandable unavailable
      states, bounded retries and no misleading successful-save/booking messages.
- [ ] **FP-25 / P0 / Eng + QA:** Test a paid checkout during database unavailability.
      Do not acknowledge an unpersisted webhook as processed or ask already-paid
      clients to pay again. Evidence: independent alerts and idempotent reconciliation
      after recovery; essential payment jobs remain enabled.
- [ ] **FP-26 / P0 / Owner:** By 6 October, review seven days of measured usage
      against the current cycle and required workload. If it cannot fit Free, choose
      explicit scope reduction or approve a costed capacity alternative. Evidence:
      recorded decision before the deadline. No automatic upgrade, project transfers,
      paid add-ons or quota-evasion project creation.

## F. Verification and completion gate

- [ ] **FP-27 / P0 / Eng:** For every implementation batch run relevant tests,
      `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`. Record actual
      results and baseline warnings; do not mark external integrations verified by
      source-only tests.
- [ ] **FP-28 / P0 / QA:** Test mobile/desktop images, CMS publishing, two-user
      privacy, therapist calendars, simultaneous paid bookings, CSV export and 402
      recovery on staging. Evidence: redacted screenshots/references/network traces.
- [ ] **FP-29 / P0 / Owner + Eng:** Demonstrate lower bytes per comparable visit,
      both egress forecasts <= 80%, storage/database headroom and no newly exceeded
      quota for seven days. Evidence: before/after usage normalized for traffic.
      Lighthouse improvement alone is not evidence of billed-egress reduction.
- [ ] **FP-30 / P0 / Owner:** Approve staged changes through a feature PR to
      `develop`, then a separate approved release PR to `main`. Preserve rollback.
      Confirm sustained results over two full cycles before calling the resource
      problem resolved; do not expect optimization to erase prior-cycle usage.

## Recurring operating routine

### Request-reduction batch, 13 September 2026

Branch: `feature/egress-01-request-dedup`. Local implementation is complete for
the changes below; the encompassing checklist items remain unchecked until all
their requirements and staging evidence are satisfied.

| Items         | Progress in this batch                                                                                                                                                                             | Remaining verification/work                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| FP-11 / FP-12 | Header/footer reuse root site details; site/footer published data cached for 60 seconds; homepage concurrent reads coalesced; immediate local invalidation after site/footer saves.                | Multi-instance freshness/publish UAT; other public endpoints and unused payload fields still need review. |
| FP-14         | Hidden-tab header interval skips verification; Google activity polling pauses when hidden and waits for prior poll completion.                                                                     | Other polling/search paths and signed-in focus/token-event duplication remain to audit.                   |
| FP-16         | Anonymous sessions avoid getUser/signOut network work; signed-in and expired sessions still use existing verification/revocation logic.                                                            | Real login, inactivity, role changes and cross-tab UAT.                                                   |
| FP-27 / FP-28 | Premerge follow-up: 174 tests pass with no skips; typecheck/build pass; lint has zero errors and seven existing warnings. Browser request counts, CSRF checks and responsive screenshots captured. | Real staging verification, external integrations and organization usage evidence remain pending.          |

See [batch verification and manual tests](SUPABASE_REQUEST_REDUCTION_BATCH_1.md).
This is not completion of image conversion, retention, backups, quota alerts,
402 incident handling or the overall Free-plan objective.

Record a date and result each time; these are recurring duties, not one-time Done items.

| Frequency            | Owner       | Required check                                                                                                        |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Daily until stable   | Owner       | Update both egress forecasts and alert thresholds; inspect spikes, 402s and failed payment recovery.                  |
| Weekly               | Eng         | Review top assets/endpoints, storage/database growth, query latency, connections, background jobs and backup success. |
| Each content release | QA          | Check upload/display byte budgets, variant storage growth, cache freshness and original image preservation.           |
| Each code release    | Eng + QA    | Complete FP-27/FP-28 and compare network payloads against baseline.                                                   |
| Each billing reset   | Owner       | Record prior-cycle totals and new reset dates/allowances; recalculate daily budgets.                                  |
| Monthly              | Owner + Eng | Test restore/recovery, review retention candidates and confirm the required workload still fits Free.                 |

For cycle-based budgets use `max(0, 0.8 * allowance - used) / days_remaining`.
Forecast with the larger of the recent 3-day and 7-day daily averages. Storage,
database size and peak connections need capacity/growth checks, not this monthly
consumption formula. Details and incident procedure are in the linked egress plan.

## Evidence log

| ID                  | Named owner        | Status                             | Branch/commit  | Baseline and result               | Staging evidence/date        | Approval               |
| ------------------- | ------------------ | ---------------------------------- | -------------- | --------------------------------- | ---------------------------- | ---------------------- |
| FP-01               | Owner              | Done: screenshot confirmation only | Not applicable | Free and grace deadline confirmed | User screenshot, 13 Sep 2026 | Not a release approval |
| FP-02 through FP-30 | Assign before work | Not Started / verification pending | Pending        | Pending                           | Pending                      | Pending                |

Use one row per item when work starts. Suggested statuses: Not Started, In
Progress, Ready for UAT, UAT Passed, Production Ready, Done. No actual usage
reduction, restore, 402 recovery or staging release has been verified by creating
this checklist. Current measured GB and other resource totals are still needed.
