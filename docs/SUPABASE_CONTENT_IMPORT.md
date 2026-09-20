# Supabase content import

The public Talk Space WordPress content was snapshotted on 15 July 2026 through
the WordPress REST API:

- 9 pages
- 84 posts
- 7 categories
- 100 records total

The records are seeded by
`supabase/migrations/20260715120000_talkspace_content_seed.sql` into
`public.content_entries`. The source snapshot is transformed into internal
canonical paths; the migration review queue derives the corresponding legacy URL
from each WordPress content type and slug.
Titles, excerpts, publication dates, authors, category IDs, and source HTML are
stored in the database.

The importer is available at `scripts/import-talkspace-content.mjs` for future
source snapshots. Generate a new migration with:

```bash
node scripts/import-talkspace-content.mjs supabase/migrations/YYYYMMDDHHMMSS_talkspace_content_seed.sql
supabase db push --linked
node --env-file=.env scripts/import-talkspace-media.mjs
```

The media migration creates a public `content-media` Supabase Storage bucket,
`content_media` metadata, and `content_entry_media` relationships. The media
import downloads every image referenced by the snapshot into that bucket and
rewrites body, excerpt, featured-media, and internal links to local values.
Binary files live in Storage while their metadata and content relationships live
in Postgres; this keeps the database manageable without leaving a runtime
dependency on the original domain.

Content is stored as source HTML and is not rendered directly by the application.
Any future CMS or blog route must sanitize the HTML and validate links/media
before rendering it in a browser.

The media importer requires the server-only `SUPABASE_SERVICE_ROLE_KEY` in the
local environment. Never expose it as a `VITE_*` variable or commit it.

Published entries are publicly readable. Only users with the `admin` role may
insert, update, or delete content entries through Supabase RLS.

## Current migration inventory

The source inventory was refreshed on 2 August 2026 without importing or deleting
records. See [`migration/WORDPRESS_INVENTORY_2026-08-02.md`](migration/WORDPRESS_INVENTORY_2026-08-02.md)
and its machine-readable JSON companion. Refresh it with `npm run content:inventory -- YYYY-MM-DD`.

WordPress currently reports 182 media records but returns 179 through the public
REST collection. The three-record discrepancy is retained as an explicit review
item for the content owner rather than being treated as migrated content.

The complete legacy URL artifact is
[`migration/LEGACY_URL_INVENTORY_2026-08-02.md`](migration/LEGACY_URL_INVENTORY_2026-08-02.md),
with JSON and CSV companions. Refresh it without writing to WordPress or Supabase
using `npm run content:urls -- YYYY-MM-DD`.

Administrators select migration content at `/admin/migration`. Every non-pending
decision requires a reason and records the reviewer and timestamp; changing a
decision also creates an immutable admin audit event. Publication status is not
treated as content-owner approval.

## Exporting current settings and content

`npm run db:export-seed` writes every configuration and public-content row into a
re-runnable migration (`supabase/migrations/<timestamp>_data_seed.sql`) so a fresh
project keeps all settings, services, therapists, availability, FAQs, page sections
and content entries after migrations run.

- Every statement is `ON CONFLICT DO NOTHING`, so it is safe to re-apply.
- Client, appointment, payment, submission and audit tables are excluded (personal data).
- Encrypted credential columns (email API key, Paystack, Google OAuth secrets) are
  excluded and must be re-entered from the admin settings screens.
