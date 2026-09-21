# Supabase backup bundle

This bundle was created before changing Supabase credentials/project settings.
It contains database SQL dumps, Supabase Storage bucket metadata, and downloaded storage objects.

## Contents

- `database/full-database.sql` — default Supabase CLI schema dump.
- `database/data-only.sql` — default Supabase CLI data-only dump.
- `database/full-public-auth-storage.sql` — schema dump for `public`, `auth`, and `storage`.
- `database/data-public-auth-storage.sql` — data-only dump for `public`, `auth`, and `storage`.
- `storage/` — downloaded bucket objects, preserving bucket/path layout.
- `metadata/storage-buckets.json` — bucket metadata from Storage API.
- `metadata/storage-objects.json` — downloaded object manifest and byte counts.
- `metadata/sha256sums.txt` — checksums for every file in this bundle.

## Sensitive data warning

Treat this folder and its archive as confidential. It may include client records, contact forms,
payment references, auth metadata, and uploaded files.

## Restore notes

For a fresh Supabase project, normally run the app migrations first, then restore row data only if
needed. If doing a full database restore, use a privileged Postgres connection and review schema
ownership/extensions before applying the expanded dumps.

Storage objects can be re-uploaded bucket-by-bucket from `storage/<bucket-name>/...` after buckets
exist in the target project.
