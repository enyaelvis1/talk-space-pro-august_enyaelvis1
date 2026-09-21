# Supabase Request Duplication Fix Checklist

Date: 21 September 2026
Branch: `feature/admin-email-template-editor`
Scope: browser Auth/RPC traffic, protected server functions, admin loaders,
public reads, Storage requests, retries, and staging verification.

This checklist is for eliminating avoidable duplicate requests without weakening
authentication, authorization, freshness, or mutation safety. Do not use `.env`
files, production data, remote SQL, or production deployments as test fixtures.

## Current status

- [x] Public shell settings use one combined `site_settings` read.
- [x] Public read caches coalesce concurrent misses and expire after 60 seconds.
- [x] Browser auth no longer uses a fixed one-minute polling interval.
- [x] Request-scoped server auth context memoizes `getUser()` and role checks.
- [x] Browser role results are now reused for a bounded 60-second window across
      focus/visibility refreshes and cleared on sign-out or user changes.
- [x] Focused request-reduction tests pass locally: 28/28.
- [x] Request-budget unit tests pass locally: 2/2.
- [ ] Browser egress fixture completes successfully with Chromium.
- [ ] All protected server functions use the shared request auth context.
- [ ] Browser role checks are limited to the roles required by the active surface.
- [ ] Remaining admin loader fan-out has been reviewed and measured.
- [ ] Storage and scheduled-job traffic has been verified in staging.
- [ ] Production release evidence has been approved.

## Phase 1 — Establish a reproducible baseline

- [ ] Record the deployed commit SHA, environment, Supabase project, plan, and
      measurement window. Local commit and environment details are recorded in
      `docs/SUPABASE_REQUEST_BASELINE_2026-09-21.md`; deployed/project/plan data
      still requires staging access.
- [ ] Capture an anonymous public-page Network trace on a cold visit and a warm
      reload. The local synthetic fixture was attempted but failed before
      producing valid counts; see the baseline report.
- [ ] Capture an authenticated admin trace for the dashboard and two high-traffic
      admin pages. Blocked pending a staging target and approved UAT access.
- [ ] Repeat with one visible tab, one hidden tab, and two open tabs. Blocked
      pending a working browser fixture or staging target.
- [ ] Group requests by Auth, REST/RPC, server functions, Storage, Realtime,
      status, and response bytes. The grouping implementation and unit tests are
      present, but no new browser sample set was produced.
- [ ] Save only redacted request metadata; never save cookies, tokens, payloads,
      or `.env` values. Confirmed for this audit.
- [x] Stop production-backed Lighthouse, seed, import, and retry loops during
      measurement.

## Phase 2 — Finish browser Auth/RPC deduplication

Relevant code: `src/lib/browser-auth-state.ts`, `src/lib/auth.ts`.

- [ ] Define the required browser authorization surface for each route group:
      admin, therapist, progress, client, or unauthenticated.
- [ ] Stop the global auth snapshot from querying both `admin` and `therapist`
-      roles on every refresh when only one role is needed. The shared public
      header still needs both roles; repeated refreshes now reuse the bounded
      role cache.
- [ ] Reuse an already verified session for route guards and role checks.
- [x] Coalesce concurrent `getSession()`, `getUser()`, and role-check calls.
- [x] Keep auth refresh event-driven: auth events, focus/visibility return, and
      near-expiry only.
- [ ] Verify hidden tabs do not schedule Supabase requests.
- [ ] Verify logout, expiry, reconnect, role changes, and two-tab behavior.
- [x] Add regression coverage for event-driven refresh and bounded browser role
      reuse. Deployed per-surface request limits still require staging UAT.

## Phase 3 — Migrate every protected server function

Relevant code: `src/lib/server-auth.ts`, `src/lib/admin.functions.ts`,
`src/lib/booking.functions.ts`, `src/lib/payments.functions.ts`,
`src/lib/contact.functions.ts`, and related function modules.

- [ ] Inventory every direct `client.auth.getUser()` call.
- [ ] Inventory every direct `rpc("has_role")` call.
- [ ] Replace duplicate authorization calls with `getRequestAuthContext()` or
      `requireRequestRole()` where the shared context is valid.
- [ ] Preserve independent authorization when a function is called directly.
- [ ] Pass the request auth context through functions invoked by one loader.
- [ ] Keep booking availability, payment state, client records, and therapist
      calendars authoritative and uncached.
- [ ] Enable `TALKSPACE_AUTH_METRICS=1` only in a protected local/staging run
      and confirm one user lookup plus only the required role checks per request.
- [ ] Add negative tests for missing credentials, invalid credentials, and
      insufficient roles.

## Phase 4 — Reduce admin loader fan-out

- [ ] Inventory initial server-function calls for every authenticated route.
- [ ] Consolidate independent read-only calls when they share authorization,
      freshness, and failure behavior.
- [ ] Keep mutation-triggered refreshes narrow; do not reload an entire workspace
      after changing one resource.
- [ ] Paginate remaining large admin lists and select only required columns.
- [ ] Bound signed-URL batches for media and attachments.
- [ ] Verify route loaders do not perform a browser auth lookup after the server
      payload already contains the needed permission.
- [ ] Record before/after request counts and response bytes for each changed route.

## Phase 5 — Validate public reads and Storage traffic

- [ ] Confirm anonymous pages make no unnecessary Auth or Realtime requests.
- [ ] Confirm root shell data is reused by header, footer, and nested routes.
- [ ] Confirm public caches do not contain private, role-protected, booking, or
      payment data.
- [ ] Trace image requests at desktop and mobile widths on cold and warm visits.
- [ ] Confirm responsive Supabase image transformations prevent original-size
      downloads.
- [ ] Confirm images are not downloaded again when the same URL is reused.
- [ ] Confirm media-library pagination and signed-URL limits in the admin UI.

## Phase 6 — Prevent retry and scheduled-job request storms

- [ ] Verify public route recovery allows at most one automatic retry per error
      window.
- [ ] Verify polling waits for the previous request to finish before starting
      another request.
- [ ] Verify hidden-tab polling pauses and cleanup removes listeners/timers.
- [ ] Verify payment, reminder, email, Google, and publishing jobs use bounded
      batches.
- [ ] Verify provider retries have caps and backoff.
- [ ] Verify cron definitions do not register duplicate schedules.
- [ ] Compare staging provider logs with expected job counts.

## Phase 7 — Automated verification

Run separately so a browser fixture timeout cannot hide other results:

```sh
node --experimental-strip-types --test test/egress-request-reduction.test.ts
node --experimental-strip-types --test test/request-budget.test.ts
CHROME_PATH=/usr/bin/google-chrome \
  node --experimental-strip-types --test test/egress-public-shell.e2e.test.ts
npx tsc --noEmit
npm run lint
npm run build
npm test
```

- [ ] All focused request tests pass.
- [ ] Chromium egress test passes rather than being skipped or timing out.
- [ ] TypeScript check passes.
- [ ] Lint passes, with any existing warnings documented.
- [ ] Production build passes.
- [ ] Full test suite passes with no unexplained skips.
- [ ] `git diff --check` passes.
- [ ] Confirm no secrets, `.env` values, or unrelated files are included.

## Phase 8 — Staging/UAT acceptance

- [ ] Deploy the feature branch through the approved path to staging only.
- [ ] Capture anonymous and authenticated Network traces from the deployed SHA.
- [ ] Compare request counts and uncached/cached bytes against the baseline.
- [ ] Confirm one visible admin tab produces no periodic idle refresh.
- [ ] Confirm hidden tabs produce no scheduled Supabase requests.
- [ ] Confirm two tabs do not multiply auth refreshes unnecessarily.
- [ ] Confirm each protected request remains user-scoped and authorized.
- [ ] Test booking, payment, webhook, email, and Google mutations for idempotency.
- [ ] Attach redacted evidence and document any expected external-provider calls.
- [ ] Obtain approval before opening the separate `develop` to `main` release PR.

## Definition of done

The issue is fixed only when all of the following are true:

1. Focused and full automated checks pass.
2. No avoidable duplicate Auth/RPC request remains in the audited paths.
3. Public, private, booking, and payment data retain their intended cache rules.
4. Storage and scheduled-provider traffic have staging evidence.
5. Security and mutation behavior remain unchanged.
6. Request counts and bytes improve against a documented baseline.
