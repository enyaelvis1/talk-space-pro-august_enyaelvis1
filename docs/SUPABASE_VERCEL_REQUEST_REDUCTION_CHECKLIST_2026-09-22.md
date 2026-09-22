# Supabase and Vercel Request Reduction Checklist — 22 September 2026

This checklist separates browser-to-Vercel traffic from Vercel-to-Supabase
traffic. The Supabase dashboard's API Gateway and Auth counters do not by
themselves prove that the database is overloaded.

## Milestone 1 — Establish the request baseline

- [ ] Record deployed commit, environment, Vercel project, Supabase project,
      plan, and exact measurement window. Production URL and local commit were
      recorded; deployed SHA, project plan, and billing window still require
      dashboard access.
- [x] Capture a production public-page trace for a cold visit, warm reload,
      internal navigation, and a navigation-link hover without clicking. The
      redacted trace observed 26 responses for cold and warm reloads, 25 for
      internal navigation, and no responses during hover-only interaction.
- [ ] Capture authenticated traces for the admin dashboard, bookings, and
      payments pages with one visible tab, one hidden tab, and two tabs. This
      remains blocked pending secure UAT credentials and an approved target.
- [x] Export redacted Vercel request metadata grouped by path, status,
      `x-vercel-cache`, and cache headers for the public trace. The document
      records only aggregate results; no query strings or tokens were saved.
- [ ] Export redacted Supabase metadata grouped by API Gateway path, Auth
      path, REST/RPC path, status, user agent, and response bytes. The public
      browser trace observed Storage image responses but no direct Auth or REST
      responses; dashboard log export is still required.
- [x] Do not save cookies, authorization headers, tokens, payloads, or `.env`
      values in evidence.

## Milestone 2 — Reduce duplicate Vercel requests

- [x] Set TanStack Router's preload policy to `false` and retain a 30-second
      reuse window for any future route that opts into preloading explicitly.
- [x] Verify the change reduces duplicate route requests in a browser trace:
      hover-only navigation produced no route response.
- [x] Review `defaultPreload` behavior and disable intent preloading globally;
      large or low-intent routes therefore do not create speculative requests.
- [x] Confirm route loaders do not refetch on every render or tab focus. Source
      contracts and the production SPA navigation trace passed this check.
- [x] Keep payment, booking, confirmation, and authenticated mutations
      explicit; never cache their responses at the CDN. Existing private
      `no-store` headers and request-reduction contracts remain in place.

## Milestone 3 — Make anonymous content CDN-cacheable safely

- [ ] Identify public-only routes and server functions that contain no user,
      draft, payment, or authorization data.
- [ ] Replace broad `no-store` headers only on those public responses with a
      short CDN TTL and stale-while-revalidate policy.
- [ ] Keep authenticated, draft/editor, booking, payment, webhook, and OAuth
      responses `private, no-store`.
- [ ] Add publish-triggered cache invalidation or an acceptable freshness
      window for CMS edits.
- [ ] Verify `x-vercel-cache` changes from `BYPASS`/`MISS` to `HIT`/`STALE` on
      anonymous pages without caching private responses.

## Milestone 4 — Reduce Supabase REST/API Gateway traffic

- [ ] Consolidate duplicate public shell and CMS reads into bounded server
      functions with request coalescing.
- [x] Remove the anonymous `getCmsPermissions` probe from public CMS pages;
      signed-in admin state now comes from the shared browser auth snapshot.
- [x] Avoid the second categories query for published page entries; category
      lookup remains only for post entries that display categories.
- [ ] Confirm the public read cache works across the deployed runtime strategy;
      do not assume an in-process cache is shared across Vercel instances.
- [ ] Group Supabase API Gateway logs by exact path and identify the top three
      callers before changing queries.
- [ ] Reduce repeated Auth session checks across focus, visibility, and route
      transitions while preserving expiry and logout behavior.
- [ ] Keep Google activity polling visible-tab-only, serialized, and disabled
      when the page is not active.
- [ ] Confirm no new polling or retry loop is introduced.

## Milestone 5 — Verify and promote

- [ ] Run focused request-budget, navigation, auth, typecheck, lint, and build
      checks.
- [ ] Repeat the production/UAT traces from Milestone 1 and compare requests,
      cache status, Supabase API calls, Auth calls, and bytes.
- [ ] Verify payment, booking, confirmation, admin, and CMS editing flows.
- [ ] Update this checklist with evidence and known external limitations.
- [ ] Follow `feature/*` → PR to `develop` → UAT → release PR to `main`.

## Current finding

The 22 September production response for `https://www.talkspace.ng/` returned
`Cache-Control: no-store` and `x-vercel-cache: MISS`. This makes every uncached
HTML request reach the Vercel origin. The dashboard sample showed 1,024 API
Gateway requests, 267 Auth requests, and 18 Postgres requests in 60 minutes;
the request mix is therefore consistent with origin/public traffic and session
verification rather than a Postgres query loop.

## Evidence recorded

- Existing request-reduction contract tests: 70 passing.
- Focused request-reduction tests after this milestone: 52 passing.
- Production public trace: cold 26 responses, warm reload 26, internal SPA
  navigation 25, hover-only 0; HTML remained `MISS` with `no-store`.
- Router policy now explicitly disables speculative preloads in
  `src/router.tsx`.
- Public CMS pages no longer send an anonymous permission server-function
  request, and published page loaders no longer issue an unnecessary category
  query. About and Pricing now show a route skeleton while their loader runs.
- Authenticated browser trace, Vercel metrics, and Supabase path-level logs
  still require a controlled UAT measurement window.

## Load-time investigation — 22 September 2026

- Production `/about` browser sample: DOM content loaded in approximately
  2.5 seconds and network idle in approximately 3.9 seconds.
- Production `/pricing` browser sample: DOM content loaded in approximately
  2.1 seconds and network idle in approximately 3.9 seconds.
- Local Vite development `/about` sample took approximately 6 seconds to
  compile and hydrate on a cold dev server; that is not representative of the
  production bundle.
- The production traces showed repeated signed brand-image requests and
  `no-store` HTML. Query strings and signed tokens were intentionally excluded
  from evidence.
