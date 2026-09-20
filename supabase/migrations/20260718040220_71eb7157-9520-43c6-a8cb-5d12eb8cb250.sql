-- Optional sandbox seed role cleanup.

drop policy if exists content_entries_sandbox_seed on public.content_entries;
drop policy if exists content_entries_sandbox_seed_update on public.content_entries;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sandbox_exec') then
    revoke insert, update on public.content_entries from sandbox_exec;
  end if;
end $$;
