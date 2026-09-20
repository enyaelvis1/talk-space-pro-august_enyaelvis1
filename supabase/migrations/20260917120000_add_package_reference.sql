-- Give each package a stable, human-readable reference for payment and booking support.
alter table public.client_session_packages
  add column if not exists reference text;

update public.client_session_packages
set reference = 'PKG-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where reference is null;

alter table public.client_session_packages
  alter column reference set default ('PKG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  alter column reference set not null;

create unique index if not exists client_session_packages_reference_idx
  on public.client_session_packages (reference);

drop function if exists public.get_session_package_by_token(text);

create or replace function public.get_session_package_by_token(
  p_access_token_hash text
) returns table(
  id uuid,
  reference text,
  client_name text,
  client_email text,
  client_phone text,
  service_id uuid,
  service_name text,
  session_mode public.session_mode,
  purchased_sessions integer,
  used_sessions integer,
  remaining_sessions integer,
  status public.session_package_status,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pkg.id,
    pkg.reference,
    pkg.client_name,
    pkg.client_email,
    pkg.client_phone,
    pkg.service_id,
    svc.name as service_name,
    pkg.session_mode,
    pkg.purchased_sessions,
    pkg.used_sessions,
    greatest(pkg.purchased_sessions - pkg.used_sessions, 0) as remaining_sessions,
    case
      when pkg.status = 'active'
       and pkg.expires_at is not null
       and pkg.expires_at <= now()
        then 'expired'::public.session_package_status
      when pkg.status = 'active'
       and pkg.used_sessions >= pkg.purchased_sessions
        then 'exhausted'::public.session_package_status
      else pkg.status
    end as status,
    pkg.expires_at
  from public.client_session_packages pkg
  join public.services svc on svc.id = pkg.service_id
  where pkg.access_token_hash = lower(trim(p_access_token_hash))
  limit 1;
$$;

revoke all on function public.get_session_package_by_token(text) from public;
grant execute on function public.get_session_package_by_token(text)
  to anon, authenticated, service_role;
