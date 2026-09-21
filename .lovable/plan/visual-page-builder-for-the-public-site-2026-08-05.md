# Visual page builder for the public site

Today the Services page (and About, Pricing, etc.) is designed in code: the eyebrow, big serif heading, service cards and the auto-playing image gallery are hardcoded React. The CMS can only replace all of that with a plain article (title, text, one image), which is why editing from the admin loses the design.

The fix is to describe each page as a list of **sections** stored in the database, and render those sections with the same components the site already uses. Once a page is data, it can be edited in two places from the same source of truth:

1. In the admin builder at `/admin/public-pages`.
2. Directly on the live page, when you are signed in as an admin — click any heading, paragraph, image or card and edit it in place.

## Section library (the building blocks)

Each is a real site component, so what you build looks exactly like the current design:

- Page hero — eyebrow, serif heading (with optional italic emphasis), intro text, buttons
- Rich text — the existing WYSIWYG editor
- Card grid — icon, title, tagline, description, bullet list, image, link (this is what the Services list is made of)
- Image gallery — the auto-playing scroller with captions from the screenshot
- Feature/split — image on one side, text and bullets on the other
- Callout — highlighted panel
- CTA banner — heading, sentence, button
- FAQ accordion, testimonials, therapist grid — pull from existing data or manual entries
- Spacer/divider

Every section has appearance options: background surface (cream/card/deep), spacing, container width, alignment.

## Admin builder (`/admin/public-pages`)

- Left: section outline — drag to reorder, duplicate, hide, delete.
- Centre: the page rendered exactly as visitors see it; click a section to select it.
- Right: settings panel for the selected section (text fields, image picker with cropping, buttons, repeatable card items).
- Top bar: page picker, device width (mobile/tablet/desktop), Edit/Preview toggle, autosave status, Save draft, Publish, Preview draft, History.
- Add section: a gallery of section types with thumbnails, insertable anywhere.

Everything already built stays: draft/publish, scheduling, SEO panel, revisions/rollback, admin-only permissions, autosave.

## Live on-page editing (WordPress-style)

- When an admin is signed in, every public page shows a floating edit bar: "Edit this page", plus draft/published indicator.
- Entering edit mode makes text editable in place, shows hover outlines with a small toolbar per section (move up/down, duplicate, settings, delete), and lets images be swapped from the media library.
- Changes save to the page draft; the bar shows unsaved/saving state and has Discard, Save draft and Publish.
- Visitors never see any of this; the editing code only loads for admins.

## Migrating existing pages

Each existing page's current design is converted once into sections with its real content and images (Services becomes hero + card grid + gallery + CTA, About becomes hero + values grid + CTA, and so on). After conversion the code renders from the database, and the current hardcoded JSX is removed. Legal/simple pages become hero + rich text.

## Technical notes

- Storage: a `sections` array (typed JSON) on `content_entries.metadata`, validated with Zod. Existing `body_html` is kept as a rich-text section, so nothing is lost and revisions/rollback keep working unchanged.
- One renderer, `SectionRenderer`, maps section type to the existing site components (`Section`, `SectionBadge`, `AutoPlayGallery`, `OptimizedImage`, `Reveal`, `Button`). Public routes, the admin canvas, the draft preview and inline editing all use it — one design, one code path.
- Editing chrome is a wrapper (`EditableSection`) mounted only when the visitor has the admin role; loaded lazily so public bundles and page speed are unaffected.
- Reordering uses `@dnd-kit` (small, already-common dependency).
- Saves go through the existing admin server functions with the current admin role checks; every save writes a revision.
- Images use the existing media library, signed URLs and crop dialog.

## Build order

1. Section schema + renderer, with Services rebuilt from data as the reference page.
2. Admin builder UI (outline, canvas selection, settings panel, add/reorder).
3. Convert the remaining public pages to sections and remove the hardcoded versions.
4. Inline on-page editing for signed-in admins.
5. Polish: device preview widths, keyboard access, empty states, docs update.
