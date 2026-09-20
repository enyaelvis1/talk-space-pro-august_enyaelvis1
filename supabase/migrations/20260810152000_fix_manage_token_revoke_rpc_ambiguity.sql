-- Qualify appointments columns in the revoke RPC so PL/pgSQL output column
-- names do not collide with table columns during the update.

create or replace function public.revoke_appointment_manage_token(
  p_appointment_id uuid,
  p_reason text default null
) returns table(
  id uuid,
  manage_token_revoked_at timestamptz,
  manage_token_revocation_reason text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  update public.appointments as a set
    manage_token = null,
    manage_token_revoked_at = coalesce(a.manage_token_revoked_at, now()),
    manage_token_revoked_by = auth.uid(),
    manage_token_revocation_reason = coalesce(
      nullif(trim(p_reason), ''),
      a.manage_token_revocation_reason,
      'manual_admin_revoke'
    ),
    updated_at = now()
  where a.id = p_appointment_id
  returning a.id,
            a.manage_token_revoked_at,
            a.manage_token_revocation_reason
  into id, manage_token_revoked_at, manage_token_revocation_reason;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  return next;
end;
$$;

revoke all on function public.revoke_appointment_manage_token(uuid, text) from public;
grant execute on function public.revoke_appointment_manage_token(uuid, text)
  to authenticated, service_role;
