# Supabase Request Audit and Reduction Checklist

Date: 21 September 2026
Branch: `feature/egress-11-admin-loader-consolidation`
Scope: browser, server-function, public-content, storage, polling, retry, and
scheduled-provider request paths.
Safety: `.env` was not read or modified. No production data or remote SQL was
changed.

## Dashboard interpretation

The reviewed dashboard screenshot showed **235 API Gateway**, **15 Storage**,
and **0 Postgres** requests in the selected window. API Gateway is not a
database-only counter. It can include Auth, REST/RPC, server-function traffic,
and other requests routed through Supabase. The request count alone does not
establish billed egress; transferred bytes and cached versus uncached usage are
required.

## Audit findings

### Confirmed request multipliers

- [x] **Browser auth refresh was periodic.** Fixed in Milestone B by replacing
      the fixed interval with auth-event, focus/visibility, and expiry-driven
      refreshes.
      Before the fix, `src/lib/browser-auth-state.ts` refreshed the session every
      minute while a tab was visible. `getVerifiedBrowserSession()` performs
      `getSession()` and `getUser()` (`src/lib/auth.ts:62-93`), then the store
      performs both admin and therapist `has_role` RPCs. One open authenticated
      tab could therefore create repeated Auth/RPC traffic while idle.
- [x] **Server-function authorization repeats per function.**
      `src/lib/admin.functions.ts:44-61` and
      `src/lib/payments.functions.ts:30-48` each call `auth.getUser()` and
      `has_role`. Similar guards exist in booking, availability, clients, email,
      and other function modules. Migrated workspace loaders now authorize once
      per request while preserving independent function guards.
- [x] **Browser and server authorization are separate work units.**
      The browser auth snapshot improves UI sharing, but it does not remove the
      server-side authorization required for every protected request. The fix must
      preserve server authorization while avoiding duplicate checks inside one
      request. Login and browser admin guards reuse the verified session for
      role-specific checks instead of re-running session verification.
- [x] **Admin loaders fan out.**
      Payments, Google Calendar, bookings, clients, and CMS routes intentionally
      load multiple server functions. The payments loader now uses one authorized
      workspace request for settings, package services, and payment rows; remaining
      route fan-out still needs route-specific review.

### Controlled or not a Supabase multiplier

- [x] Google activity polling uses `startVisiblePolling` and only runs while a
      therapist is expanded (`src/routes/_authenticated.admin.google.tsx:205-209`).
      It waits for completion and pauses hidden tabs.
- [x] Public route automatic recovery is bounded by the route-recovery guard;
      it is not an unbounded retry loop. Keep the one-retry limit covered by tests.
- [x] Public published settings and homepage reads use bounded in-process
      caches and in-flight coalescing. These reduce warm-instance reads but do not
      eliminate cold-start or cross-instance traffic.
- [x] Shared public imagery uses transformed responsive URLs and non-critical
      images are lazy-loaded.
- [x] Homepage carousel, review carousel, checkout countdown, and booking clock
      timers update local state and do not directly call Supabase.
- [ ] Storage traffic still needs a staging trace to distinguish expected
      public image/media loads from duplicate downloads.
- [ ] Scheduled payment, reminder, Google, and publishing hooks need provider
      logs checked for duplicate registration or overlapping runs.

## Remediation milestones

### Milestone A: establish a trustworthy baseline

- [ ] Record the selected project, organization, billing-cycle dates, plan,
      cached egress, uncached egress, and service totals.
- [ ] Export one anonymous browser trace and one authenticated admin trace.
- [ ] Repeat with one visible admin tab, one hidden tab, and two open tabs.
- [ ] Group requests by Auth, REST/RPC, server functions, Storage, and bytes.
- [ ] Stop production-backed Lighthouse, seed, import, and test loops during
      measurement; use local fixtures or staging.
- [ ] Attach redacted request evidence and the exact deployed build SHA.

### Milestone B: replace periodic browser authorization

- [x] Refresh on auth events, focus, visibility return, and near-expiry only.
- [x] Remove the fixed one-minute interval after proving expiry handling.
- [x] Cache a verified snapshot for a bounded period and coalesce concurrent
      refreshes.
- [x] Query only the role required by the current protected surface where
      possible; do not weaken server-side authorization.
- [x] Add static and focused regression coverage for event-driven refresh and
      removal of the interval.
- [ ] Complete browser UAT for logout, expiry, role changes, two tabs, hidden
      tabs, and reconnects.

### Milestone C: consolidate server authorization per request

- [x] Add request-scoped auth/admin context after the bearer token is verified.
- [x] Memoize each role check within that request context.
- [x] Pass that context through functions invoked by one route loader.
- [x] Ensure each migrated protected server function still rejects
      missing/invalid
      credentials when called independently.
- [x] Avoid calling `getUser()` and `has_role` twice in the same migrated
      request path.
- [x] Add static regression coverage for the shared context and migrated guards.
- [x] Add request-level integration evidence proving duplicate RPCs fall to one
      per request. Opt-in `TALKSPACE_AUTH_METRICS=1` response headers expose the
      per-request `getUser` and `has_role` counts without adding production traffic
      when disabled; focused tests cover the instrumentation contract.

### Milestone D: reduce loader fan-out safely

- [x] Inventory each admin route's initial server-function calls and response
      sizes.
- [x] Consolidate the homepage editor's three initial settings reads into one
      authorized server function without changing its response shape.
- [x] Consolidate the Google Calendar admin page's settings and therapist
      connection reads into one authorized server function.
- [x] Consolidate the settings page's site-details and footer reads into one
      authorized settings-table query.
- [x] Consolidate the email admin page's initial settings, delivery-log, and
      reminder reads into one authorized workspace request.
- [x] Consolidate the admin dashboard's today and upcoming appointment reads
      into one authorized workspace request.
- [x] Consolidate the admin dashboard's summary and failure-queue reads into
      one authorized workspace request while preserving independent fallbacks.
- [x] Return the admin progress permission with the server progress payload so
      the dashboard does not issue a second browser auth lookup.
- [x] Consolidate the admin Services page's service and therapist reads into
      one authorized workspace request while keeping refreshes service-only.
- [x] Consolidate the admin Forms page's template and pending-intake reads into
      one authorized workspace request.
- [x] Consolidate the content editor's entry and category reads into one
      authorized workspace request while preserving entry refreshes.
- [x] Consolidate the Audit page's audit-log and security-event reads into one
      authorized workspace request while preserving the security-event fallback.
- [x] Consolidate the client detail entry and assessment-template reads into
      one authorized workspace request.
- [x] Consolidate the Payments page's settings and package-service reads into
      one authorized setup workspace request while keeping payment rows separate.
- [x] Consolidate the Settings page's site, email, payment, and Google reads into
      one authorized workspace request while preserving its response shape.
- [ ] Consolidate remaining read-only route data only where authorization and
      failure behavior remain equivalent.
- [x] Select only required media columns and paginate the admin media library
      so the initial read and signed-URL batch are capped at 100 items.
- [x] Keep booking availability, payment state, tokens, client records, and
      therapist calendars authoritative and uncached; regression coverage now
      guards these modules against the public read cache.
- [ ] Select only required columns and paginate remaining large admin lists.
      The client directory now pages 100 rows per request with "Load more"; the
      remaining CMS/admin lists still need an inventory pass before this umbrella
      item can be closed.
- [x] Re-run booking/payment and private-data isolation tests after changes.
      Payment commitment and package-payment isolation tests pass; the live
      therapist-concurrency test remains environment-skipped when DB credentials
      are unavailable.

### Milestone E: verify storage and scheduled jobs

- [ ] Trace image and media requests on public pages at desktop and mobile
      widths, including a cold and warm visit.
- [x] Confirm responsive transformations prevent original-size downloads.
      `OptimizedImage` emits Supabase render URLs with bounded width, height, and
      quality plus responsive `srcSet` candidates; public performance tests cover
      the implementation.
- [ ] Review hosting cron definitions and provider logs for duplicate jobs.
      Local Vercel config has one scheduled payment recheck; provider dashboard
      logs still need review for deployed cron duplication.
- [x] Require idempotency keys and bounded batches for payment, reminder,
      email, Google, and publishing jobs.
      Payment email claims, bounded Paystack rechecks, bounded reminder scans,
      and bounded email retry batches are present in the code paths. Live provider
      delivery evidence remains a staging task.
- [x] Confirm failed provider work does not trigger immediate retry storms.
      Email retries use a three-attempt cap with backoff, and scheduled payment
      rechecks and reminder scans use bounded batches.

## Acceptance gates

- [ ] Anonymous public pages produce no unnecessary Auth traffic.
- [x] One visible admin tab has no fixed periodic auth refresh while idle.
- [ ] Hidden tabs produce no scheduled Supabase requests.
- [ ] Two tabs coalesce auth refreshes where the browser permits it.
- [ ] Each protected server request remains authorized and user-scoped.
- [ ] Admin route fan-out and response bytes are measured before and after.
- [ ] No duplicate booking hold, payment mutation, webhook, email, or Google
      mutation is introduced.
- [ ] Supabase comparison uses request counts plus cached/uncached bytes.
- [ ] Staging evidence is attached before merging any production release.

## Evidence commands

Local static and focused checks:

```sh
npx tsc --noEmit
npm run lint
node --experimental-strip-types --test test/egress-request-reduction.test.ts
node --experimental-strip-types --test test/egress-public-shell.e2e.test.ts
npm run build
```

Staging evidence must be captured from the browser Network panel and the
Supabase usage dashboard. Local synthetic fixtures validate regressions but do
not prove production quota savings.

## Current conclusion

The fixed visible-tab browser auth poll is removed and the focused checks pass.
The migrated server guards now share a request-scoped user and role context.
The application is not request-clean yet: separate server-function calls from
one admin loader still authorize independently, and browser UAT plus request
level measurement remain before changing public caching or disabling any
security check.
