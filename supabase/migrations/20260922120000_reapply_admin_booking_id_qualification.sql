-- Re-apply the admin booking RPC with qualified column references.
-- The earlier correction migration may already be recorded on projects that
-- received an older version of that migration before its contents were fixed.

create or replace function public.create_admin_appointment(
  p_client_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_service_id uuid,
  p_therapist_id uuid,
  p_session_mode public.session_mode,
  p_starts_at timestamptz,
  p_notes text,
  p_manage_token_hash text,
  p_payment_method text default 'unpaid',
  p_payment_status text default 'pending',
  p_amount_kobo bigint default 0,
  p_package_id uuid default null
)
returns table (
  id uuid,
  booking_reference text,
  status public.appointment_status,
  payment_reference text,
  package_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  svc public.services%rowtype;
  therapist public.therapists%rowtype;
  pkg public.client_session_packages%rowtype;
  appointment_id uuid;
  appointment_reference text;
  payment_reference_value text;
  appointment_end timestamptz;
  appointment_status public.appointment_status;
  payment_provider_value public.payment_provider;
  payment_status_value public.payment_status;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if p_client_id is null
     or length(trim(coalesce(p_client_name, ''))) < 2
     or length(trim(coalesce(p_client_email, ''))) < 3
     or length(trim(coalesce(p_client_phone, ''))) < 7
     or length(trim(coalesce(p_manage_token_hash, ''))) <> 64
     or p_manage_token_hash !~ '^[0-9a-fA-F]{64}$'
     or p_starts_at <= now()
  then
    raise exception using errcode = 'P0001', message = 'invalid_booking';
  end if;

  select * into svc
  from public.services
  where public.services.id = p_service_id
    and public.services.is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_unavailable';
  end if;

  select * into therapist
  from public.therapists
  where public.therapists.id = p_therapist_id
    and public.therapists.is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'therapist_unavailable';
  end if;

  if not exists (
    select 1
    from public.clients
    where public.clients.id = p_client_id
  ) then
    raise exception using errcode = 'P0001', message = 'client_not_found';
  end if;

  appointment_end := p_starts_at + make_interval(mins => svc.duration_minutes);

  if not exists (
    select 1
    from public.list_available_slots(
      p_service_id,
      (p_starts_at at time zone 'Africa/Lagos')::date,
      (p_starts_at at time zone 'Africa/Lagos')::date,
      p_session_mode
    ) available
    where available.therapist_id = p_therapist_id
      and available.starts_at = p_starts_at
      and available.ends_at = appointment_end
      and available.mode = p_session_mode
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  if p_package_id is not null then
    if p_payment_status <> 'confirmed' or p_payment_method <> 'package' then
      raise exception using errcode = 'P0001', message = 'invalid_package_payment';
    end if;

    select * into pkg
    from public.client_session_packages
    where public.client_session_packages.id = p_package_id
    for update;
    if not found or not public.session_package_is_active(pkg) then
      raise exception using errcode = 'P0001', message = 'package_inactive';
    end if;
    if pkg.service_id <> p_service_id
       or (pkg.session_mode is not null and pkg.session_mode <> p_session_mode)
       or lower(pkg.client_email) <> lower(trim(p_client_email))
    then
      raise exception using errcode = 'P0001', message = 'package_mismatch';
    end if;

    update public.client_session_packages
    set used_sessions = used_sessions + 1,
        status = case when used_sessions + 1 >= purchased_sessions
          then 'exhausted'::public.session_package_status else status end,
        updated_at = now()
    where public.client_session_packages.id = pkg.id;
    appointment_status := 'confirmed';
  elsif p_payment_status = 'confirmed' then
    if p_payment_method not in ('bank_transfer', 'paystack') then
      raise exception using errcode = 'P0001', message = 'payment_required';
    end if;
    appointment_status := 'confirmed';
  elsif p_payment_status = 'pending' then
    if p_payment_method not in ('unpaid', 'bank_transfer', 'paystack') then
      raise exception using errcode = 'P0001', message = 'invalid_payment_method';
    end if;
    appointment_status := 'pending_payment';
  else
    raise exception using errcode = 'P0001', message = 'invalid_payment_status';
  end if;

  if p_session_mode not in ('online', 'in_person') then
    raise exception using errcode = 'P0001', message = 'invalid_session_mode';
  end if;

  appointment_reference := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.appointments (
    booking_reference, client_id, client_name, client_email, client_phone,
    therapist_id, service_id, session_mode, starts_at, ends_at, status,
    hold_expires_at, manage_token_hash, notes, package_id
  ) values (
    appointment_reference, p_client_id, trim(p_client_name), lower(trim(p_client_email)),
    trim(p_client_phone), p_therapist_id, p_service_id, p_session_mode,
    p_starts_at, appointment_end, 'pending_payment', null,
    lower(trim(p_manage_token_hash)), nullif(trim(p_notes), ''), p_package_id
  ) returning public.appointments.id into appointment_id;

  if p_package_id is null and p_payment_method <> 'unpaid' then
    payment_provider_value := p_payment_method::public.payment_provider;
    payment_status_value := case when p_payment_status = 'confirmed'
      then 'succeeded'::public.payment_status
      when p_payment_method = 'bank_transfer'
      then 'awaiting_confirmation'::public.payment_status
      else 'initiated'::public.payment_status end;
    payment_reference_value := 'ADM-' || upper(substr(md5(gen_random_uuid()::text), 1, 12));
    insert into public.payments (
      appointment_id, provider, reference, amount_kobo, status, metadata,
      verified_by, verified_at, created_by
    ) values (
      appointment_id, payment_provider_value, payment_reference_value,
      greatest(coalesce(p_amount_kobo, 0), 0), payment_status_value,
      jsonb_build_object('created_by_admin', true),
      case when payment_status_value = 'succeeded' then auth.uid() else null end,
      case when payment_status_value = 'succeeded' then now() else null end,
      auth.uid()
    );
  end if;

  if appointment_status = 'confirmed' then
    update public.appointments
    set status = 'confirmed',
        hold_expires_at = null,
        paid_amount_kobo = case when p_package_id is not null
          then 0 else greatest(coalesce(p_amount_kobo, 0), 0) end,
        payment_reference = case when p_package_id is not null
          then 'PACKAGE-' || upper(substr(p_package_id::text, 1, 8))
          else payment_reference_value end,
        updated_at = now()
    where public.appointments.id = appointment_id;
  end if;

  return query
  select a.id, a.booking_reference, a.status, a.payment_reference,
         a.package_id, a.starts_at, a.ends_at
  from public.appointments a
  where a.id = appointment_id;
end;
$$;

revoke all on function public.create_admin_appointment(
  uuid, text, text, text, uuid, uuid, public.session_mode, timestamptz,
  text, text, text, text, bigint, uuid
) from public, anon;
grant execute on function public.create_admin_appointment(
  uuid, text, text, text, uuid, uuid, public.session_mode, timestamptz,
  text, text, text, text, bigint, uuid
) to authenticated, service_role;
