-- Optional sandbox seed role support.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sandbox_exec') then
    grant insert on public.content_entries to sandbox_exec;
  end if;
end $$;
