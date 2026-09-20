-- Qualify package-session counter columns inside PL/pgSQL functions. The
-- functions return columns named used_sessions and purchased_sessions, so
-- unqualified table columns can become ambiguous at runtime.

create or replace function public.consume_session_package_credit(
  p_appointment_id uuid,
  p_access_token_hash text
) returns table(
  package_id uuid,
  purchased_sessions integer,
  used_sessions integer,
  remaining_sessions integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  pkg public.client_session_packages%rowtype;
begin
  select * into appt
  from public.appointments
  where public.appointments.id = p_appointment_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'appointment_not_found';
  end if;

  select * into pkg
  from public.client_session_packages
  where access_token_hash = lower(trim(p_access_token_hash))
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'package_not_found';
  end if;

  if not public.session_package_is_active(pkg) then
    raise exception using errcode = 'P0001', message = 'package_inactive';
  end if;

  if appt.service_id <> pkg.service_id then
    raise exception using errcode = 'P0001', message = 'package_service_mismatch';
  end if;

  if lower(appt.client_email) <> lower(pkg.client_email) then
    raise exception using errcode = 'P0001', message = 'package_client_mismatch';
  end if;

  if appt.package_id is not null then
    raise exception using errcode = 'P0001', message = 'appointment_already_packaged';
  end if;

  update public.client_session_packages
  set used_sessions = public.client_session_packages.used_sessions + 1,
      status = case
        when public.client_session_packages.used_sessions + 1
             >= public.client_session_packages.purchased_sessions
          then 'exhausted'::public.session_package_status
        else public.client_session_packages.status
      end,
      updated_at = now()
  where id = pkg.id
  returning * into pkg;

  update public.appointments
  set package_id = pkg.id,
      status = 'confirmed'::public.appointment_status,
      hold_expires_at = null,
      paid_amount_kobo = coalesce(public.appointments.paid_amount_kobo, 0),
      payment_reference = coalesce(
        public.appointments.payment_reference,
        'PACKAGE-' || upper(substr(pkg.id::text, 1, 8))
      ),
      updated_at = now()
  where id = appt.id;

  package_id := pkg.id;
  purchased_sessions := pkg.purchased_sessions;
  used_sessions := pkg.used_sessions;
  remaining_sessions := greatest(pkg.purchased_sessions - pkg.used_sessions, 0);
  return next;
end;
$$;

revoke all on function public.consume_session_package_credit(uuid, text) from public;
grant execute on function public.consume_session_package_credit(uuid, text)
  to anon, authenticated, service_role;

create or replace function public.activate_session_package_for_payment(
  p_payment_id uuid
) returns table(
  package_id uuid,
  client_email text,
  purchased_sessions integer,
  used_sessions integer,
  remaining_sessions integer,
  access_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payment public.payments%rowtype;
  appt public.appointments%rowtype;
  service_record public.services%rowtype;
  pkg public.client_session_packages%rowtype;
  raw_token text;
begin
  select * into payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_not_found';
  end if;

  if payment.status <> 'succeeded' then
    return;
  end if;

  select * into appt
  from public.appointments
  where id = payment.appointment_id
  for update;
  if not found then
    return;
  end if;

  select * into service_record
  from public.services
  where id = appt.service_id;
  if not found or service_record.sessions_per_package <= 1 then
    return;
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
      source_payment_id,
      purchased_sessions,
      used_sessions,
      status,
      access_token_hash,
      access_token,
      expires_at,
      created_by
    ) values (
      appt.client_id,
      appt.client_name,
      appt.client_email,
      appt.client_phone,
      appt.service_id,
      payment.id,
      service_record.sessions_per_package,
      1,
      case
        when service_record.sessions_per_package <= 1
          then 'exhausted'::public.session_package_status
        else 'active'::public.session_package_status
      end,
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      now() + interval '6 months',
      auth.uid()
    )
    returning * into pkg;
  end if;

  if appt.package_id is null then
    update public.appointments
    set package_id = pkg.id,
        updated_at = now()
    where id = appt.id;
  end if;

  if pkg.used_sessions = 0 then
    update public.client_session_packages
    set used_sessions = 1,
        status = case
          when public.client_session_packages.purchased_sessions <= 1
            then 'exhausted'::public.session_package_status
          else public.client_session_packages.status
        end,
        updated_at = now()
    where id = pkg.id
    returning * into pkg;
  end if;

  package_id := pkg.id;
  client_email := pkg.client_email;
  purchased_sessions := pkg.purchased_sessions;
  used_sessions := pkg.used_sessions;
  remaining_sessions := greatest(pkg.purchased_sessions - pkg.used_sessions, 0);
  access_token := pkg.access_token;
  return next;
end;
$$;

revoke all on function public.activate_session_package_for_payment(uuid) from public;
grant execute on function public.activate_session_package_for_payment(uuid)
  to authenticated, service_role;
