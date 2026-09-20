-- Duplicate grants, appointment-management, contact, and email setup snapshot.
-- The corresponding schema/RPC changes are already applied by earlier focused
-- migrations. Keep this migration as a safe permission repair.

do $$
declare
  tbl text;
begin
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('grant all on public.%I to service_role', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end $$;

grant select on public.content_entries to anon;
grant select on public.content_entry_media to anon;
grant select on public.content_media to anon;
grant select on public.services to anon;
grant select on public.therapists to anon;
grant select on public.therapist_services to anon;
