# Supabase Request Investigation and Free-plan Reduction Runbook

Created: 19 September 2026  
Status: investigation complete; implementation work is not included in this document.  
Related: [Supabase egress reduction plan](SUPABASE_EGRESS_REDUCTION_PLAN.md) and [Free-plan maintenance checklist](SUPABASE_FREE_PLAN_MAINTENANCE_CHECKLIST.md).

## Executive summary

The Supabase dashboard screenshot shows a request spike, but it does not by
itself prove which endpoint or page caused it:

- 911 total requests in the selected last-60-minutes window.
- 646 API Gateway requests.
- 242 Auth requests.
- 16 Storage requests.
- 7 Postgres requests.
- 0 Edge Function requests.
- 100% success rate.

The same screenshot says the organization exceeded its previous billing-cycle
quota and may be restricted from 13 October 2026. Treat that as an incident
warning. It is not evidence that the application is under attack, and request
counts are not the same as cached or uncached egress bytes.

The strongest code-level finding is repeated authentication work in the admin
shell. `SiteHeader` and `AdminSidebar` independently verify sessions and roles,
and both schedule a 30-second refresh while mounted. On an authenticated admin
page this can create approximately 11 auth/RPC operations per 30-second cycle
before counting route loaders, server functions, or other page reads:

| Caller         | Work per refresh                                                   | Current cadence                   |
| -------------- | ------------------------------------------------------------------ | --------------------------------- |
| `SiteHeader`   | one session/user verification plus admin and therapist role checks | 30 seconds while visible          |
| `AdminSidebar` | one admin role check plus a second session/user verification       | 30 seconds, including hidden tabs |

This is an estimate of logical auth operations, not a billing calculation. Verify
the actual network requests in a browser trace before assigning savings.

## What the audit found

### 1. Admin auth checks are duplicated

Relevant files:

- `src/components/site/SiteHeader.tsx`
- `src/components/progress/AdminSidebar.tsx`
- `src/lib/auth.ts`

`getVerifiedBrowserSession()` calls `auth.getSession()` and then
`auth.getUser()`. `hasBrowserRole()` calls `getVerifiedBrowserSession()` again
before calling the `has_role` RPC. The header calls that path for both `admin`
and `therapist`; the sidebar calls it for `admin` and then verifies the session
again. This is the most plausible explanation for the relatively high Auth
count in the screenshot, especially while an admin tab is open.

The application should have one browser auth snapshot shared by the header,
sidebar, and admin dashboard. A role check should be reused until an auth event,
logout, tab-visible refresh, or an explicit permission-sensitive action requires
fresh validation.

### 2. The sidebar refreshes while a tab is hidden

`SiteHeader` skips its interval when `document.hidden` is true. The sidebar’s
30-second interval calls `syncAccessState()` directly and does not make that
check. Sleeping tabs therefore continue to create auth traffic.

This is a small code change with a clear acceptance test: hidden tabs produce no
scheduled Supabase requests, and returning to the tab performs at most one
refresh.

### 3. Public page data is read through several paths

Relevant files:

- `src/routes/__root__.tsx`
- `src/routes/index.tsx`
- `src/components/site/SiteFooter.tsx`
- `src/components/site/sections/LiveSections.tsx`
- `src/lib/content.functions.ts`

The root loader reads site details. The footer separately reads footer settings.
The homepage has a combined data loader, while editable/live sections can also
read form templates, FAQs, and therapists through React Query. React Query
deduplicates some calls within one browser session, but route loaders and server
function calls are not a substitute for a shared, cross-request public cache.

Several public content functions explicitly send `Cache-Control: no-store`.
That is appropriate for private or immediately consistent data, but it means a
normal navigation can repeatedly traverse the application and Supabase for
published content. Public published content can use a short, measured TTL;
private client records, payment data, tokens, availability commitments, and
auth responses must remain uncached and user-scoped.

The existing `createPublicReadCache` is an in-process 60-second cache with
in-flight request coalescing. It reduces repeated reads on a warm server
instance, but it is not shared across serverless instances and does not remove
the application request itself. Measure its hit rate before treating it as a
complete solution.

### 4. Retry behavior can amplify an outage

`src/routes/__root__.tsx` and `src/routes/index.tsx` automatically invalidate a
public route after 1.5 seconds when a public load fails. During a Supabase or
network incident, this can turn one failure into a repeating request loop for
every open visitor tab.

Automatic recovery should be bounded: one delayed retry at most, then a visible
manual retry. Use exponential backoff with a maximum attempt count if automatic
recovery is retained.

### 5. Some timers are not Supabase traffic

The homepage carousel, review carousel, checkout countdown, and the bookings
clock update local React state. They do not directly create Supabase requests.
Do not remove them as an egress fix. Google activity polling is already behind
`startVisiblePolling` and only runs for an expanded therapist, so it should be
measured separately rather than disabled broadly.

### 6. Route loaders can make normal navigation look noisy

Admin routes fetch their own datasets and protected server functions validate the
caller. The admin dashboard also performs a loader-side data collection and then
does a client-side role/session check before showing the result. This is useful
for UX authorization feedback but duplicates permission work. Prefer one loader
authorization result for rendering, while keeping server-side authorization on
every mutation and sensitive read.

## Ordered fix plan

### P0: establish the baseline before changing production behavior

- [ ] Record the organization plan, billing-cycle dates, cached egress,
      uncached egress, previous-cycle totals, and all projects in the organization.
- [ ] Use a redacted browser Network export for one anonymous visit and one
      authenticated admin visit. Filter requests to the Supabase project domain and
      group by Auth, REST/RPC, Storage, and application server-function calls.
- [ ] Repeat the admin trace with one visible tab, one hidden tab, and two open
      tabs. Record requests per minute and response bytes.
- [ ] Inspect the Supabase usage view for bytes and top services. Do not infer
      egress from the 911 request count.
- [ ] Stop production-backed Lighthouse, import, seed, and browser loops while
      measuring. Run those against local fixtures or an approved staging project.

### P1: remove the largest confirmed request multipliers

- [ ] Add a single browser auth store/provider that owns session, admin role,
      therapist role, refresh state, and the last verification timestamp.
- [ ] Make `SiteHeader`, `AdminSidebar`, and the admin dashboard consume that
      snapshot instead of independently calling `getVerifiedBrowserSession()` and
      `hasBrowserRole()`.
- [ ] Replace both 30-second auth intervals with one visible-tab refresh. On
      `visibilitychange` or focus, coalesce concurrent refreshes into one promise.
- [ ] Add the hidden-tab guard to any remaining timer. Never refresh a hidden tab
      on a fixed interval.
- [ ] Remove the dashboard’s duplicate client permission check if the loader
      already returns an authorized, server-validated result. Keep all server-side
      checks for protected data and mutations.
- [ ] Bound automatic router retries to one attempt or exponential backoff.

### P1: reduce safe public reads

- [ ] Consolidate site details and footer settings into one public shell payload
      where practical.
- [ ] Give published anonymous content a documented short TTL, for example
      60-300 seconds, with explicit publish invalidation. Do not put authenticated
      or user-specific responses in this cache.
- [ ] Reuse one React Query cache key for live FAQs, therapists, and form
      templates, and avoid mounting duplicate live sections that query the same
      resource independently.
- [ ] Select only required columns and paginate admin/content lists. Keep booking
      availability and payment status authoritative and uncached.

### P1/P2: control background and provider work

- [ ] Keep Google activity polling visible-only, expanded-only, non-overlapping,
      and bounded with backoff after provider failures.
- [ ] Audit email retry, payment recheck, reminder, and Google webhook schedules
      on the hosting provider. Ensure each job has one owner, an idempotency key, a
      bounded batch, and no duplicate cron registration.
- [ ] Treat provider errors as unavailable states instead of retrying immediately.
      Never retry payment mutations blindly.

## Safe implementation boundaries

Do not solve this by disabling authorization, caching private responses, removing
payment reconciliation, or making booking availability stale. In particular:

- Client records, clinical notes, intake submissions, payment rows, manage
  tokens, auth responses, and therapist-specific calendars must remain private
  and uncached.
- A cached availability response may help display choices, but the final hold
  or booking transaction must re-check availability server-side.
- Do not delete content, images, bookings, logs, or database rows to reduce an
  egress warning. That does not erase already recorded usage.
- Do not repeatedly download the entire media library while investigating.
- Do not upgrade the plan, enable paid services, or alter production data as
  part of this runbook without explicit owner approval.

## Verification gates

For each implementation batch, compare the same workflows before and after:

1. Anonymous homepage, services, therapists, journal, and booking visit.
2. Authenticated admin dashboard with one visible tab.
3. Admin tab hidden for five minutes, then made visible.
4. Two admin tabs open simultaneously.
5. Admin navigation across bookings, payments, clients, and CMS pages.
6. Google calendar activity opened and closed.
7. Booking availability refresh, slot hold, payment initiation, and callback.

Acceptance criteria:

- Auth refreshes are coalesced and no hidden-tab polling occurs.
- Public content request count and bytes decrease without stale private data.
- No duplicate booking hold, payment, webhook, email, or Google mutation occurs.
- Two users cannot see each other’s private data.
- A Supabase 402 or temporary outage produces a bounded, understandable error
  rather than a retry storm.
- The same-workload usage comparison includes cached and uncached bytes, not
  only request counts.
- The change passes `npm test`, `npx tsc --noEmit`, `npm run lint`, and
  `npm run build`, followed by staging/UAT and a separate release PR.

## Daily operating check until the warning clears

- Record cached and uncached egress, request volume, and the top service.
- Compare the current daily average with the remaining cycle budget.
- Investigate any spike above twice the recent three-day average.
- Treat any 402, auth storm, duplicate payment attempt, or failed webhook as an
  incident; stop nonessential refresh loops and preserve payment recovery.
- Keep seven days of before/after evidence. A quieter hour does not prove the
  quota problem is resolved.

## Current conclusion

The screenshot establishes a real quota risk, but not a single proven offender.
The code audit identifies duplicated admin auth/session verification and an
unconditional hidden-tab sidebar timer as the first fixes to measure. The next
decision should be based on the redacted request trace and Supabase byte-level
usage, then implemented in small feature branches through `develop` and UAT.
