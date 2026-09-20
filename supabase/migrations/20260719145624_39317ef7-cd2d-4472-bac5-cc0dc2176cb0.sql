-- Duplicate consolidated content and booking snapshot.
-- The underlying schemas and RPCs are created by earlier canonical migrations
-- and subsequent focused repair migrations.

grant all on public.content_entries to service_role;
grant all on public.content_media to service_role;
grant all on public.content_entry_media to service_role;
grant all on public.appointments to service_role;
