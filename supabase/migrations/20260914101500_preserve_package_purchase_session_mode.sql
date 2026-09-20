-- Preserve an optional mode selected during purchase-first checkout.
-- This forward migration avoids modifying the already-applied purchase-first migration.

create or replace function public.confirm_package_purchase(
  p_reference text,
  p_service_id uuid,
  p_client_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_purchased_sessions integer,
  p_expires_at timestamptz default null
) returns public.client_session_packages
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payment public.payments%rowtype;
  pkg public.client_session_packages%rowtype;
  raw_token text;
begin
  select * into payment
  from public.payments
  where reference = p_reference
  for update;

  if not found then
    raise exception using errcode='P0001', message='payment_not_found';
  end if;

  if payment.payment_kind <> 'package_purchase' then
    raise exception using errcode='P0001', message='payment_kind_mismatch';
  end if;

  if payment.status <> 'succeeded' then
    raise exception using errcode='P0001', message='payment_not_succeeded';
  end if;

  if p_purchased_sessions is null or p_purchased_sessions <= 0 or p_purchased_sessions > 50 then
    raise exception using errcode='P0001', message='invalid_session_count';
  end if;

  select * into pkg
  from public.client_session_packages
  where source_payment_id = payment.id
  for update;

  if not found then
    raw_token := encode(gen_random_bytes(32), 'hex');

    insert into public.client_session_packages (
      client_id,
      client_name,
      client_email,
      client_phone,
      service_id,
      session_mode,
      source_payment_id,
      purchased_sessions,
      used_sessions,
      status,
      access_token_hash,
      access_token,
      expires_at,
      created_by
    ) values (
      p_client_id,
      p_client_name,
      p_client_email,
      p_client_phone,
      p_service_id,
      nullif(payment.metadata->>'session_mode', '')::public.session_mode,
      payment.id,
      p_purchased_sessions,
      0,
      'active',
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      coalesce(p_expires_at, now() + interval '6 months'),
      auth.uid()
    )
    returning * into pkg;
  end if;

  return pkg;
end;
$$;

revoke all on function public.confirm_package_purchase(text, uuid, uuid, text, text, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.confirm_package_purchase(text, uuid, uuid, text, text, text, integer, timestamptz)
  to service_role;
