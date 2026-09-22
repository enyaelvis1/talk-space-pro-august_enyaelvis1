# Supabase and Vercel Request Reduction Checklist — 22 September 2026

This checklist separates browser-to-Vercel traffic from Vercel-to-Supabase
traffic. The Supabase dashboard's API Gateway and Auth counters do not by
themselves prove that the database is overloaded.

## Milestone 1 — Establish the request baseline

- [ ] Record deployed commit, environment, Vercel project, Supabase project,
      plan, and exact measurement window.
- [ ] Capture a production public-page trace for a cold visit, warm reload,
      internal navigation, and a navigation-link hover without clicking.
- [ ] Capture authenticated traces for the admin dashboard, bookings, and
      payments pages with one visible tab, one hidden tab, and two tabs.
- [ ] Export redacted Vercel request metadata grouped by path, status,
      `x-vercel-cache`, user agent, and cache reason where available.
- [ ] Export redacted Supabase metadata grouped by API Gateway path, Auth
      path, REST/RPC path, status, user agent, and response bytes.
- [ ] Do not save cookies, authorization headers, tokens, payloads, or `.env`
      values in evidence.

## Milestone 2 — Reduce duplicate Vercel requests

- [x] Increase TanStack Router's preload reuse window to 30 seconds so hover
      preloads are reused by the subsequent navigation.
- [ ] Verify the change reduces duplicate route requests in a browser trace.
- [ ] Review `defaultPreload` behavior and disable intent preloading on routes
      where the payload is large or the user is unlikely to navigate there.
- [ ] Confirm route loaders do not refetch on every render or tab focus.
- [ ] Keep payment, booking, confirmation, and authenticated mutations
      explicit; never cache their responses at the CDN.

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
- First implementation in this milestone: router preload reuse set to 30
  seconds in `src/router.tsx`.
- Production browser trace, Vercel metrics, and Supabase path-level logs still
  require a controlled UAT measurement window.
