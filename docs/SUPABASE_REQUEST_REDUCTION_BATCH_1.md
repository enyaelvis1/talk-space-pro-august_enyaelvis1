# Request reduction: batch 1

Date: 13 September 2026. Branch: `feature/egress-01-request-dedup` from `develop`.
Status: locally implemented; staging/UAT and release approval outstanding.

## Changes

- Header and footer use the root route's site details instead of fetching the
  same settings again after mounting. No extra browser settings cache is added.
- Site and footer settings use bounded, separate 60-second public-data caches.
  Simultaneous requests share one pending load. Failures are not cached as
  successful data. Admin saves invalidate the corresponding process's caches.
- Homepage reads retain their existing 60-second lifetime but now coalesce
  concurrent misses. They no longer repeat the full five-query batch immediately
  when any query fails. Existing last-good/default fallback behavior is retained.
- Invalidation prevents older pending responses repopulating the cache. An
  already-running caller can still receive its earlier snapshot; subsequent
  loads use the new cache generation.
- Anonymous session checks return before calling Auth getUser or signOut.
  Signed-in checks still verify the user; expiry still follows the existing
  revocation path. The max-age calculation uses the actual user last-sign-in
  field instead of nonexistent `Session.created_at`.
- Header interval checks skip hidden tabs. Google activity polling waits until
  the previous poll completes, pauses when hidden, resumes on visibility, and
  stops on cleanup. Manual refresh and essential sync/payment jobs remain.
- Restore the missing client-contact helper already imported by payments on
  develop. This small build prerequisite overlaps the helper in PR #152; it
  does not import that PR's payment, SQL or CSV changes.

Only anonymous published data is cached. Private data, role checks, authenticated
HTML, booking availability and payments do not use the new cache. HTTP responses
retain `no-store`; the optimization is in the public-data loading layer.

## Measured local results

- 20 simultaneous cache reads: one loader call. Another call occurs at expiry.
- Failed load: all concurrent callers share the error; a subsequent load can recover.
- Admin invalidation during an old load: old data cannot overwrite a newer value.
- 20 anonymous session checks: zero getUser/signOut calls. A valid session still
  verifies; an expired one still signs out.
- Full application using a local Supabase HTTP fixture: first visit queries site
  details once and footer settings once. Ten further warm SSR homepage visits
  add zero fixture API requests, within the same process/cache window.
- Desktop/mobile public rendering and menu interaction verified using synthetic
  content. No page JavaScript errors in the successful fixture run.

Evidence (synthetic data, not a production account):

- [Request counts](../output/playwright/egress/request-counts.json)
- [Desktop](../output/playwright/egress/public-desktop.png)
- [Mobile menu](../output/playwright/egress/public-mobile.png)

These numbers are not measured production GB savings. Warm in-process caching
does not survive cold starts and is not globally shared across replicas. Another
replica can retain settings until its 60-second entry expires; already-open tabs
are not pushed edits automatically. Verify freshness on a new navigation/reload.

## Automated verification

```sh
node --experimental-strip-types --test test/egress-request-reduction.test.ts test/public-performance-accessibility.test.ts test/egress-public-shell.e2e.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The browser test uses a local fake API, synthetic keys, blocked external browser
requests and an isolated Vite cache. It does not write to Supabase production.
Install Chrome/Chromium or set `CHROME_PATH`; do not silently count a skipped
browser test as verified.

Premerge follow-up, 13 September 2026:

| Check              | Latest result                                             |
| ------------------ | --------------------------------------------------------- |
| `npm test`         | 174 passed, zero failures, zero skips                     |
| `npx tsc --noEmit` | Passed                                                    |
| `npm run lint`     | Passed: zero errors, seven existing Fast Refresh warnings |
| `npm run build`    | Passed; existing bundle/deprecation warnings remain       |
| `git diff --check` | Passed                                                    |

The initial batch had four baseline test failures and existing type/lint errors.
The follow-up fixes those local blockers; it does not establish staging UAT.
Test concurrency is capped at two workers to avoid competing browser/Vite
processes exhausting local or CI resources. Run the full suite and build
separately. An earlier overlapping build/test run timed out; the final full
suite passed in about 39 seconds with no skips.

## Premerge corrections

- Register the framework CSRF middleware for server functions. Same-origin
  requests remain allowed; cross-site, same-site subdomain and missing-origin
  requests are denied. OAuth callbacks and webhooks retain their separate
  state/signature validation. This follows the
  [TanStack server-function guidance](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions).
- The full-app fixture verifies three allowed metadata/header combinations
  return 200, five rejected combinations return 403, and a cross-origin POST
  returns 403 without additional database reads. An unsigned Paystack webhook
  still returns 401; an incomplete Google callback still returns 400.
  These are negative-route checks, not successful external integration tests.
- Align local database types with existing manage-token, package and payment
  columns; correct nullable fields, serializable bank-transfer results, numeric
  totals and legacy in-person pricing fallbacks. Missing payment IDs and failed
  checkout-group updates now surface errors instead of being ignored.
- Use client-side navigation and router invalidation in the client list instead
  of full-page reloads. Preserve existing authorization and mutation controls.
- Restore the operations heading and make shortcut cards fit mobile widths.
- Preserve therapist identity in same-time slot results, picker keys, checkout
  validation and intake metadata. One batched name query serves all returned
  therapist IDs; an empty slot result skips that query. Availability remains
  uncached. Database concurrency/payment rules are not changed by this patch.
- Replace the broken browser tests with isolated fixtures mounting the real
  admin overview and booking picker. These tests need no production session.
  Test the actual checkout schema for distinct therapists, duplicate instants,
  equivalent timezone offsets, consent and quantity limits; test the actual
  legacy service-write fallback.

Some narrow corrections and fixtures were reviewed and brought over from draft
PR #152. That PR was not merged. Its broader payment-integrity, CSV import and
SQL migration work remains separate and needs reconciliation before release.
No migration, production content update, billing change or deployment was run.

Additional synthetic browser evidence:

- [Admin desktop](../output/playwright/feedback/admin-1280.png)
- [Admin mobile](../output/playwright/feedback/admin-390.png)
- [Slot picker desktop](../output/playwright/feedback/slots-1280.png)
- [Slot picker mobile](../output/playwright/feedback/slots-390.png)
- [CSRF status codes and request counts](../output/playwright/egress/request-counts.json)

### Merge gate

- [x] Full automated tests, typecheck, lint and build pass locally.
- [x] Desktop/mobile component screenshots and HTTP request evidence captured.
- [x] CSRF warning addressed with tested middleware, not suppressed.
- [ ] Identify staging URL, build SHA and admin/therapist/client test accounts.
- [ ] Complete the staging checks below and attach redacted evidence/test references.
- [ ] Measure real request and cached/uncached egress trends, including cold instances.
- [ ] Reconcile overlapping PR #152 changes and obtain PR review/approval.
- [ ] Merge to `develop` only after the staging gate; do not deploy to `main`.

## What to test on staging

Local preview: `http://127.0.0.1:8085/book`. The preview uses the workspace's
configured environment, not the synthetic test API. Verify it points to staging
before submitting bookings, payments or admin edits. The read-only booking page
and service selector were smoke-tested; no test transaction was submitted.

1. Open home, pricing, journal and therapists anonymously. Confirm brand, logo,
   phone/address, footer and images match saved content. Check that header/footer
   do not each request site details after the root loader completes.
2. Repeat page requests within 60 seconds and after expiry. Compare actual
   Supabase request counts; test both warm and cold application instances.
3. Edit site details/footer as admin. Reload public pages on the same instance,
   then another instance after expiry. New content must appear; old pending
   responses must not become the new cached value. Do not use private drafts as
   shared public cache entries.
4. Sign in as admin, therapist and client separately. Confirm navigation roles,
   permission guards, sign-out, cross-tab changes and inactivity expiry. Expired
   sessions must not retain private access. Anonymous browsing should not produce
   periodic Auth getUser calls.
5. Expand Google activity. Hide the tab for two minutes; automatic activity calls
   must stop. Return and confirm refresh, then collapse/navigate away. Under a
   slow connection, automatic polls must not overlap. Real Google OAuth is not
   exercised by the fixture test.
6. Re-run booking/payment conflict, package balance and two-therapist isolation
   scenarios. This batch does not change their server-side commitment rules.
7. Simulate failed public reads, then recovery. No immediate full homepage retry
   batch should fire; a later load must recover. Complete payment-outage/402
   handling is a separate checklist item, not delivered here.
8. Open admin clients on desktop/mobile, follow a client link and return. Import
   or remove only disposable staging records; the list must refresh without a
   document reload. Check blank required fields fail validation, not a crash.
9. Give two staging therapists the same available time. Both names must appear;
   select both, remove/re-add one and submit a test checkout. Confirm each
   appointment and intake record retains its therapist. Duplicate selection of
   the same therapist/instant must fail. Verify actual paid slot isolation in the
   database separately; picker tests alone do not prove it.
10. Submit same-origin booking and admin forms behind the staging proxy. Verify
    they are not rejected by CSRF. Test Paystack sandbox webhooks and Google
    OAuth with test accounts. Do not bypass origin checks to accommodate an
    incorrectly configured proxy. CSRF is not a substitute for authentication,
    role checks or rate limiting.

Add staging build SHA, tester/date, redacted evidence and actual organization
usage trends before marking UAT Passed. No database migrations, content updates,
billing changes or production deployment are part of this batch.

## Milestone 7: Free-plan image delivery compatibility

Status: **Implemented locally; ready for review/UAT**

- Supabase-hosted public images continue to use responsive `render/image`
  transformations and existing `srcset` widths.
- Shared `OptimizedImage` output now defaults to `loading="lazy"`, so public
  section, gallery, therapist and article imagery does not compete with the
  initial document unless the call site opts into eager loading.
- Above-the-fold brand and homepage hero images retain their explicit eager
  loading and priority settings.
- Regression coverage checks both the transformed image URLs and the shared
  lazy-loading contract.

This changes browser scheduling, not stored content or Supabase data. It does
not claim that image delivery is below quota until staging Network traces and
the Supabase dashboard confirm warm and cold behavior.

### Milestone 7 checklist

- [x] Keep public Supabase images on transformed responsive URLs.
- [x] Lazy-load non-critical shared public imagery by default.
- [x] Preserve eager loading for the brand and first homepage hero image.
- [x] Add regression coverage for transformation and loading behavior.
- [ ] Verify staging image request count and transferred bytes on desktop/mobile.
- [ ] Compare warm and cold instance storage egress before release approval.

## Next priorities

Complete the staging image evidence above, then use measured request and byte
totals to choose the next payload/query optimization. Do not claim the
organization is under quota until its dashboard and forecast establish that.
Preserve backups, content, privacy and payment correctness throughout.
