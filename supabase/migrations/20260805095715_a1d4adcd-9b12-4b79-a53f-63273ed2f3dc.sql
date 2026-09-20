create schema if not exists public;
grant usage on schema public to anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

create or replace function public.__tmp_apply_migration(p_token text, p_sql text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_token is distinct from '89082553424a025eb89fd891bde776b7' then
    raise exception 'unauthorized';
  end if;
  execute p_sql;
end;
$fn$;

revoke all on function public.__tmp_apply_migration(text, text) from public;
grant execute on function public.__tmp_apply_migration(text, text) to anon, authenticated, service_role;