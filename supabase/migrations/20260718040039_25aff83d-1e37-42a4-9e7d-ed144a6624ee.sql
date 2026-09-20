-- Duplicate content media migration snapshot.
-- The canonical column rename, content_media tables, storage bucket, and RLS
-- policies are applied by 20260715130000_content_media_storage.sql.

grant all on public.content_media to service_role;
grant all on public.content_entry_media to service_role;
