# Remaining implementation checklist

This is the execution checklist for the remaining work identified in the CMS review. We will work
from top to bottom, update the status after each implementation, and run the listed checks before
moving to the next item.

Status markers: `[ ]` not started · `[~]` in progress · `[x]` complete · `[!]` blocked.

## 1. Page templates and section blocks — [x]

- [x] Add selectable page templates to the content editor.
      _Notes: Default, Landing page, and Article/Journal templates now save to content metadata, have distinct public layouts, include an admin live preview, and populate professional starter body content when selected._
- [x] Add reusable homepage/page sections.
      _Notes: Content entries now support reusable intro, feature grid, callout, and call-to-action blocks with professional starter blocks and safe public rendering._
- [x] Add drag-and-drop section ordering.
      _Notes: Section blocks can be reordered by dragging them in the content editor; the order is saved in metadata and rendered publicly._
- [x] Render saved sections safely on public pages.

Test: create a draft page, select a template, save/reload it, preview it, reorder sections, and
confirm the public page matches the saved order on desktop and mobile.

## 2. Journal taxonomy and media workflow — [x]

- [x] Add categories and tags to the post editor.
      _Notes: Journal posts can select published database categories and save comma-separated tags in content metadata._
- [x] Render category and tag context on the public blog listing and article page.
- [x] Add a searchable media picker with preview.
      _Notes: Content editors can search the admin media library by filename, alt text, or tags and select a stored asset._
- [x] Confirm categories and featured images render on `/blog` and article pages.
      _Notes: The listing renders category, tag, date, and featured media with a branded fallback; article pages render all taxonomy context and the featured image with the same fallback._

Test: create a post with a category, tag, and media asset; publish it; verify filtering and the
featured image publicly.

## 3. Brand asset management — [x]

- [x] Add favicon selector and preview.
- [x] Add social-share image selector and preview.
- [x] Add safe media-usage checks before deletion.
      _Notes: Deletion is blocked when an asset is referenced by content or site settings._

Test: change logo, favicon, and social image; verify browser tab, header, and social metadata.

## 4. Unified homepage section editor — [x]

- [x] Add admin controls for every homepage section.
- [x] Support section visibility and ordering.
      _Notes: `/admin/homepage` now saves the ordered, visible/hidden section configuration in `site_settings`, and the public homepage follows it with safe defaults._
- [x] Add draft preview before publishing.
      _Notes: The admin editor previews the current unsaved order and visibility state before the layout is saved._

Test: hide, reorder, preview, publish, and restore each homepage section.

## 5. Appearance controls — [x]

- [x] Add typography controls.
- [x] Add button style and spacing controls.
- [x] Add per-page appearance overrides.
      _Notes: Content editors can enable page-level background, text, and accent colors with the same contrast guard._
- [x] Add WCAG contrast validation before saving.
      _Notes: Site settings now validate normal-text contrast at 4.5:1 or higher and apply the saved appearance globally._

Test: save a theme, inspect all public routes, test keyboard focus, and verify contrast warnings.

## 6. Legacy website retirement — [x]

- [x] Review the imported page inventory with the content owner.
      _Notes: The Pages admin now provides all/active/archived inventory counts and filters for review._
- [x] Archive approved legacy pages.
      _Notes: Existing lifecycle controls support archive and restore without deleting the source record._
- [x] Verify redirects and remove only approved obsolete content.
      _Notes: `/admin/redirects` now verifies status code and Location target before legacy content is removed._

Test: open each retired URL, verify its redirect status and destination, then confirm it is absent
from public navigation and search results.

## 7. CMS automated coverage — [x]

- [x] Test create/edit/publish/archive/restore/delete flows.
      _Notes: `test/cms-lifecycle.test.ts` covers the content mutation contracts and lifecycle state updates._
- [x] Test admin authorization for each mutation.
      _Notes: The regression suite verifies every content mutation calls the shared `requireAdmin` guard._
- [x] Test revision restore for content entries.
      _Notes: The suite verifies the revision restore RPC and the admin restore control._

Test: run the complete automated suite and confirm unauthorized users cannot mutate content. Live
database and browser verification remain in items 8 and 11.

## 8. Admin browser verification — [~]

- [~] Verify every admin tab on desktop.
  _Notes: Automated route smoke coverage confirms the sidebar destinations resolve, and mobile route titles now identify every CMS/operations tab; interactive browser verification remains._
- [~] Verify mobile navigation, forms, loading, empty, and error states.
  _Notes: Automated coverage now checks the mobile admin drawer/header contract, route inventory,
  loading overlay, and representative form/empty states; `/admin/redirects` now uses the shared
  admin shell and a mobile-safe table. Live browser verification remains._
- [x] Verify normal-admin and progress-owner permissions.
      _Notes: Live browser verification with temporary QA admin/client accounts confirmed admin sign-in, client sign-in, admin-only dashboard access, client rejection on `/admin`, and progress-owner-only access on `/admin/progress`._

Test: complete the browser matrix and record any failures here before release.

## 9. Public design refresh — [x]

- [x] Finish remaining inner-page composition updates.
      _Notes: About now has the refreshed fallback composition with an image-led hero, values grid,
      Gbagada/Lagos story timeline, and care-coordinator CTA; Contact, Pricing, Blog, Services, and
      Emergency Support have received the matching public-page alignment pass._
- [x] Regenerate the warm social preview image.
      _Notes: `public/og-image.jpg` has been replaced with a warm 1200×630 counselling-room image
      that keeps the existing sitewide Open Graph wiring intact._
- [x] Verify responsive imagery and reduced-motion behavior.
      _Notes: Automated regression coverage now checks responsive Supabase image transforms,
      mobile image sources, key public route image usage, and reduced-motion safeguards for reveal
      and autoplay gallery animations._

Test: review Home, Services, Therapists, Pricing, Blog, Contact, and About at mobile, tablet, and
desktop widths.

## 10. Google Reviews synchronisation — [~]

- [x] Admin-editable rating, review count, label, and Google review URL.
- [x] Clickable homepage Google Reviews trust item.
- [x] Add Google Business Profile API synchronisation, if credentials and location access are
      approved.
      _Notes: The refresh path now supports Business Profile credentials, falls back to Google
      Places API using an admin-managed Place ID, records last-sync status, and can run from cron
      without an admin browser session._
- [~] Verify against the live Google Business Profile once credentials and location access are
  supplied.

Test: update the admin summary and destination link; if API work is approved, compare imported
reviews against the Google Business Profile source.

## 11. Release readiness — [ ]

- [ ] Apply and verify pending Supabase migrations.
- [x] Run automated tests and production build.
      _Notes: `npm test` and `npm run build` passed on 2026-08-24 after the public imagery and
      reduced-motion verification pass._
- [ ] Complete manual browser checks.
- [ ] Update this checklist and the main implementation checklist.

Test: run the release checklist on a production-like environment before merging to `main`.

## 12. Booking calendar experience — [x]

- [x] Add a calendar-based admin bookings view.
- [x] Surface appointments on calendar days and open a details view for the selected date.
- [x] Add a compact “now / next” section for the active day and upcoming sessions.
- [x] Keep reminders, timeline access, and booking actions intact within the new view.
- [x] Verify the new experience on desktop and tablet widths.
      _Notes: `/admin/bookings` now includes the calendar workspace, selected-day drawer, now/next
      view, drag-to-reschedule support, timeline access, reminder actions, manage-link revoke, and
      automated booking-calendar coverage. Final live browser sign-off remains tracked under admin
      browser verification and release readiness._

Test: open the admin bookings workspace, browse the calendar, select a day, and confirm the session summary is clear and uncluttered.

## 13. Public pages editable from admin — [~]

- [x] Add an admin-managed page content model for the public site pages.
- [x] Expose all core public pages in the admin editing experience.
      _Notes: `/therapists` is now registered with Admin → Public pages alongside Services,
      Pricing, About, Contact, legal, emergency support, and FAQs._
- [x] Provide a rich-text editor with formatting controls for page body content.
- [x] Support page metadata editing (title, slug, excerpt, featured media, publish state).
- [x] Preserve draft/publish/revision workflows and publish the updated page content safely.
- [~] Verify the public pages render the updated content correctly across desktop and mobile.
  _Notes: Automated coverage now verifies CMS routing, editor controls, the live therapist-list
  section, and core-route CMS overrides. Complete a browser publish pass before marking done._

Test: open the admin page editor, update a public page with formatted rich text, publish it, and verify the public route renders the new content.
