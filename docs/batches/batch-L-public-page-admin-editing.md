# Batch L — Public pages editable from admin

**Sections:** 05 (Public pages), 06 (CMS)

## Scope

- Make all public-facing pages editable from the admin experience.
- Provide a rich-text editor for page body content with formatting controls such as headings, bold, italic, lists, links, quotes, code, and image insertion.
- Keep page-specific metadata such as title, slug, excerpt, featured media, and publish state within the editing flow.
- Preserve the existing draft/publish/revision workflow so public changes remain safe and reviewable.

## Current implementation

- The CMS already supports rich-content editing for selected content entries and page templates.
- This batch will expand that capability so the public-site pages themselves can be managed from the admin without code changes.

## Acceptance

- An admin can edit the homepage and all core public pages from the admin interface.
- The editor supports rich-text formatting and content blocks suitable for public pages.
- Saving and publishing updates the public site immediately and keeps revisions available.
- The experience works for both standard pages and content-heavy routes such as About, Services, Pricing, Contact, and legal pages.
