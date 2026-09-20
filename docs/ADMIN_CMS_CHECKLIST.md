# Admin CMS and website management checklist

This checklist tracks the requested WordPress-style administration capabilities while preserving
the existing role and content-revision safeguards.

## 1. Admin dashboard

- [x] Restore the dashboard overview for every admin account.
      _Notes: The dashboard no longer fails when the progress snapshot is unavailable._
- [x] Keep implementation progress restricted to the configured progress owner.
      _Notes: Progress visibility remains controlled by `hasProgressAccess`._
- [x] Keep content-management shortcuts visible from the dashboard.

## 2. Pages

- [x] List imported pages from the database.
- [x] Edit title, slug, excerpt, body, featured image, and lifecycle status.
- [x] Create a new draft page from `/admin/pages`.
- [x] Archive or permanently delete obsolete pages with bulk actions.
- [ ] Add page templates and drag-and-drop section blocks.

## 3. Journal/blog

- [x] List imported posts from the database.
- [x] Create a new draft post from `/admin/journal`.
- [x] Edit title, slug, author, excerpt, body, featured image, and lifecycle status.
- [x] Publish, unpublish, archive, restore, and delete posts.
- [ ] Add categories/tags and a richer media picker to the editor.

## 4. Media and brand assets

- [x] Upload and manage media in the admin media library.
- [x] Upload a site logo from admin settings and persist its path.
- [ ] Add favicon and social-share image selectors with previews.
- [ ] Add media usage reporting before an asset is deleted.

## 5. Public website content

- [x] Edit the home hero copy and images.
- [x] Manage database-backed pages and journal entries.
- [x] Manage existing testimonials, FAQs, services, and therapist records through their admin tabs.
- [ ] Add a unified section editor for every homepage block.

## 6. Appearance

- [x] Add admin controls for page background, text, and accent colors.
- [x] Apply saved appearance colors on public pages.
- [ ] Add typography, button style, spacing, and per-page overrides.
- [ ] Add contrast validation before saving a theme.

## 7. Retiring the old website

- [x] Provide lifecycle controls so obsolete imported pages can be archived or removed.
- [x] Keep redirect management available for retired URLs.
- [ ] Review the imported page inventory with the content owner.
- [ ] Archive/delete approved legacy pages and verify redirects in production.

## 8. Governance and verification

- [x] Require an authenticated admin role for CMS mutations.
- [x] Preserve content revision history for recovery.
- [ ] Add automated coverage for create/edit/publish/archive flows.
- [ ] Complete a browser pass for all admin content and settings screens.

## 9. Google Reviews

- [x] Add an admin screen for the Google rating, review count, label, and destination URL.
      _Notes: Available at `/admin/google-reviews`._
- [x] Make the homepage Google Reviews trust item clickable.
      _Notes: Opens the configured Google Business/Maps reviews page in a new tab._
- [x] Protect the public homepage with fallback values before the settings migration is applied.
- [ ] Add authenticated Google Business Profile API import/synchronisation.
      _Notes: Requires Google Business Profile credentials, OAuth scopes, and a selected location.
