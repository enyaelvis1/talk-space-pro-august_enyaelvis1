-- Optional sandbox seed role support.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sandbox_exec') then
    create policy content_entries_sandbox_seed
      on public.content_entries
      for insert
      to sandbox_exec
      with check (true);
  end if;
end $$;
