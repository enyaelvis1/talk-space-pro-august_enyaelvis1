# Supabase Request Reduction Milestones

Created: 19 September 2026
Related: [Request investigation](SUPABASE_REQUEST_INVESTIGATION_2026-09-19.md)

This tracker breaks the Free-plan request reduction work into small releases.
Each milestone requires request-count and byte-level evidence from the same
workflow before and after the change. Booking availability, payment state,
private client data, auth authorization, and therapist calendars remain
authoritative and user-scoped.

## Milestone 1: shared browser auth refresh

Status: **Implemented locally; ready for review/UAT**
Branch: `feature/egress-01-auth-dedup`

Scope:

- Share one browser auth snapshot between `SiteHeader` and every
  `AdminSidebar` instance.
- Reuse one verified session for the admin and therapist role checks.
- Replace duplicate 30-second shell timers with one visible-tab 60-second
  refresh, coalescing concurrent refreshes.
- Stop the sidebar's hidden-tab refresh behavior.
- Keep server-side authorization and mutation checks unchanged.

Acceptance gates:

- [x] Typecheck, focused tests, lint, and diff checks pass.
- [ ] Full test suite passes; the current baseline run is 247 passed, 6
      failed, and 4 skipped in unrelated browser/harness and legacy contract
      tests.
- [x] Production build passes.
- [ ] One visible admin tab produces one shared auth refresh.
- [ ] Desktop and mobile sidebar renderings do not create separate timers.
- [ ] Hidden admin tabs produce no scheduled auth refresh.
- [ ] Sign-in, sign-out, expiry, admin role, and therapist role behavior passes
      staging UAT.
- [ ] Before/after Network trace and Supabase usage evidence is recorded.

Current verification note: typecheck, lint, focused auth/navigation tests, and
the production build pass. The full-suite failures are tracked as baseline
follow-up work; they include missing local test-server coverage, an existing
availability source-contract mismatch, and browser/email/payment harness
failures outside this milestone's auth-store changes.

## Milestone 2: bounded failure recovery

Status: **Not started**

Scope:

- Bound automatic public route invalidation retries.
- Use one delayed retry or exponential backoff with a maximum attempt count.
- Keep a visible manual retry for public and admin failures.
- Verify a temporary Supabase failure does not create a retry storm.

Acceptance gates:

- [ ] Failure simulation shows bounded requests.
- [ ] Recovery on a later manual retry works.
- [ ] Payment callbacks and booking mutations are not retried blindly.

## Milestone 3: public read consolidation

Status: **Not started**

Scope:

- Consolidate root site details and footer settings where practical.
- Measure and reduce duplicate public CMS reads.
- Apply short TTLs only to anonymous published content.
- Preserve explicit invalidation after admin publishing.

Acceptance gates:

- [ ] Anonymous page workflows show lower requests and bytes.
- [ ] Content freshness is within the agreed TTL after publishing.
- [ ] No private or user-scoped response enters shared cache.

## Milestone 4: admin loader and background-work audit

Status: **Not started**

Scope:

- Remove duplicate client-side role checks where a protected route loader has
  already authorized the request.
- Audit Google, email retry, payment recheck, reminder, and webhook schedules.
- Confirm each recurring job has one owner, bounded batches, backoff, and
  idempotency.

Acceptance gates:

- [ ] Admin navigation does not repeat permission reads unnecessarily.
- [ ] Hidden tabs and collapsed panels do not poll.
- [ ] Provider failure traces show bounded retries and no duplicate mutations.

## Milestone 5: measurement and operating controls

Status: **Not started**

Scope:

- Establish daily cached/uncached egress and request trend records.
- Set internal 50%, 70%, 85%, and 95% escalation thresholds.
- Retain seven days of normalized before/after evidence.
- Decide before the restriction deadline whether the required workload fits the
  Free plan.

Acceptance gates:

- [ ] Both cached and uncached forecasts are at or below the approved target.
- [ ] An independent alert path is tested.
- [ ] Owner approves scope reduction or capacity action if Free is insufficient.

## Release rules

Each milestone follows `feature/*` -> `develop` -> staging/UAT -> separate
approved release PR to `main`. Do not merge milestones directly into `main`,
apply production SQL, change billing, or delete data as part of request
reduction without explicit approval.
