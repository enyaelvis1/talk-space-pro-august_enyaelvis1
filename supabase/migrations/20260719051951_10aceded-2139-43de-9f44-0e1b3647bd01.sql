-- Duplicate content media migration snapshot.
-- The canonical content media tables, storage bucket, and service scheduling
-- columns are applied by earlier July 15 migrations.

grant all on public.content_media to service_role;
grant all on public.content_entry_media to service_role;
