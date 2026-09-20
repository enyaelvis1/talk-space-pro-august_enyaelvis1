# Batch A — Shell polish

**Sections:** 04 (Public shell), 03 (Brand/design)

## Scope

- Breadcrumbs component + wire into non-home routes.
- Real favicon set (16, 32, apple-touch, maskable).
- Real og:image (1200×630) at absolute URL, wired in `__root.tsx` and leaf routes.
- Add redirect map for legacy talkspace.ng URLs (`/beyondsilence` → `/blog/beyond-silence`, etc).

## Acceptance

- Every non-home page shows breadcrumbs.
- View source shows `<link rel="icon">`, `<meta property="og:image">` with absolute https URL.
- Legacy paths return 301 to new equivalents.
