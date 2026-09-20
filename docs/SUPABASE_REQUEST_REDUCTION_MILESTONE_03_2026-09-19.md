# Supabase Request Reduction Milestone 3

## Public shell read consolidation

Status: **Implemented locally; ready for review/UAT**

Anonymous public pages previously loaded site details through the root loader
and then made a second footer-settings request from `SiteFooter`. The root
loader now reads both published settings in one bounded public query, and the
header and footer render from that shared root payload.

### Changed surfaces

- Added `getPublicShellData()` for the published site-details/footer payload.
- Preserved the one-minute in-process public cache for anonymous settings.
- Extended `clearPublicSiteSettingsCache()` so admin publishing invalidates the
  combined shell cache as well.
- Removed the footer's client-side settings request on every public page.

### Acceptance gates

- [x] Site details and footer settings use one public Supabase read.
- [x] Header and footer consume the root shell payload.
- [x] Admin site/footer updates clear the combined public cache.
- [x] Private/user-scoped reads remain outside this cache.
- [ ] Staging confirms public page navigation has fewer requests and bytes.
- [ ] Staging confirms published footer changes appear after invalidation.
- [ ] No stale private or draft data is served from the public cache.

### Release boundary

This branch targets `develop` only. Staging/UAT should compare a fresh
anonymous page load and a navigation across public pages, then publish a
footer change in admin and confirm the next public read reflects it.
