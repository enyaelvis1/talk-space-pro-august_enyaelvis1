# Supabase Request Reduction Milestone 4

## Admin loader and background-work audit

Status: **Implemented locally; ready for review/UAT**

The protected admin parent route already verifies the browser session and
admin role before child loaders and components run. Admin child pages were
repeating the same role RPC after their data loaded, which added avoidable
Auth/Postgres traffic and delayed the first usable render. The duplicate
client-side checks are now removed from the protected child pages.

The project-progress page keeps its stronger owner-access check in
`beforeLoad`. The admin dashboard only performs the separate session lookup
needed to decide whether the owner-only progress widget is visible. Existing
Google activity polling remains visibility-aware through `startVisiblePolling`.

### Changed surfaces

- Removed duplicate admin role checks from availability, clients, client
  details, emails, journal, media, messages, pages, payments, services, and
  therapists routes.
- Kept authorization at the protected parent `beforeLoad` and server-side
  mutation boundaries.
- Preserved loading and error boundaries for actual loader failures.
- Added source-contract coverage to prevent child role polling from returning.

### Acceptance gates

- [x] Child admin routes do not repeat the parent admin role RPC.
- [x] Progress owner access remains enforced before loading the dashboard.
- [x] Existing server-side authorization and sensitive-action gates remain.
- [x] Existing visibility-aware Google background polling remains bounded.
- [ ] Staging confirms admin navigation has fewer Auth/Postgres requests.
- [ ] Staging confirms unauthorized users still redirect before child loaders.
- [ ] Provider failure traces show no duplicate background mutations.

### Release boundary

This branch targets `develop` only. Staging/UAT should inspect request traces
for admin navigation, test a non-admin route access, and verify Google
activity refresh pauses in a hidden tab and does not overlap while a request
is in flight.
