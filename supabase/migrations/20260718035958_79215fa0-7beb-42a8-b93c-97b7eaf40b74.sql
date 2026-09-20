-- Optional sandbox seed role support.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sandbox_exec') then
    grant update on public.content_entries to sandbox_exec;

    create policy content_entries_sandbox_seed_update
      on public.content_entries
      for update
      to sandbox_exec
      using (true)
      with check (true);
  end if;
end $$;
