-- Draft checkout records are not reservations. Preserve all content and images.
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

  if payment.status <> 'succeeded' or coalesce((payment.metadata->>'booking_review_required')::boolean, false) then
    return;
  end if;

  select * into appt
  from public.appointments
  where id = payment.appointment_id
  for update;
  if not found or appt.status not in ('confirmed', 'completed', 'no_show') or appt.archived_at is not null then
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
      appt.client_id,
      appt.client_name,
      appt.client_email,
      appt.client_phone,
      appt.service_id,
      appt.session_mode,
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
  elsif pkg.session_mode is null then
    update public.client_session_packages
    set session_mode = appt.session_mode,
        updated_at = now()
    where id = pkg.id
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

revoke all on function public.activate_session_package_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.activate_session_package_for_payment(uuid)
  to service_role;


alter table public.payments
  add column if not exists payment_review_email_claimed_at timestamptz;

alter table public.appointments drop constraint if exists appointments_active_slot_exclusion;
alter table public.appointments add constraint appointments_active_slot_exclusion
  exclude using gist (therapist_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'confirmed' and archived_at is null);

create or replace function public.guard_confirmed_appointment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  svc public.services%rowtype;
begin
  if new.status <> 'confirmed' or new.archived_at is not null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'confirmed' and old.archived_at is null
      and row(new.therapist_id, new.service_id, new.starts_at, new.ends_at, new.session_mode)
        is not distinct from row(old.therapist_id, old.service_id, old.starts_at, old.ends_at, old.session_mode)
    then return new; end if;
  end if;

  -- Serialize commitment for one therapist, including conflicts across services/modes.
  perform id from public.therapists where id = new.therapist_id and is_active for update;
  if not found then raise exception using errcode = 'P0001', message = 'slot_unavailable'; end if;
  select * into svc from public.services where id = new.service_id and is_active;
  if not found or new.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;
  if new.package_id is null and not exists (
    select 1 from public.payments where appointment_id = new.id and status = 'succeeded'
  ) then
    raise exception using errcode = 'P0001', message = 'payment_required';
  end if;
  if not exists (select 1 from public.therapist_services where therapist_id = new.therapist_id and service_id = new.service_id)
    or not (
      exists (select 1 from public.availability_rules r
        where r.therapist_id = new.therapist_id and r.is_active and r.mode = new.session_mode
          and r.day_of_week = extract(dow from new.starts_at at time zone r.timezone)
          and new.starts_at >= ((new.starts_at at time zone r.timezone)::date + r.starts_at) at time zone r.timezone
          and new.ends_at <= ((new.starts_at at time zone r.timezone)::date + r.ends_at) at time zone r.timezone)
      or exists (select 1 from public.availability_exceptions e
        where e.therapist_id = new.therapist_id and e.kind = 'added'
          and (e.mode is null or e.mode = new.session_mode)
          and e.starts_at <= new.starts_at and e.ends_at >= new.ends_at)
    ) then raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;
  if exists (
    select 1 from public.appointments a join public.services s on s.id = a.service_id
    where a.therapist_id = new.therapist_id and a.id <> new.id
      and a.status = 'confirmed' and a.archived_at is null
      and tstzrange(a.starts_at - make_interval(mins => s.buffer_before_minutes),
        a.ends_at + make_interval(mins => s.buffer_after_minutes), '[)') &&
        tstzrange(new.starts_at - make_interval(mins => svc.buffer_before_minutes),
          new.ends_at + make_interval(mins => svc.buffer_after_minutes), '[)')
  ) or exists (
    select 1 from public.availability_exceptions e
    where e.therapist_id = new.therapist_id and e.kind = 'blocked'
      and (e.mode is null or e.mode = new.session_mode)
      and tstzrange(e.starts_at, e.ends_at, '[)') &&
        tstzrange(new.starts_at - make_interval(mins => svc.buffer_before_minutes),
          new.ends_at + make_interval(mins => svc.buffer_after_minutes), '[)')
  ) then raise exception using errcode = 'P0001', message = 'slot_unavailable'; end if;

  update public.payments set metadata = metadata - 'booking_review_required' - 'booking_review_reason'
    where appointment_id = new.id and status = 'succeeded';
  return new;
end $$;

revoke all on function public.guard_confirmed_appointment() from public;
drop trigger if exists appointments_guard_commitment on public.appointments;
create trigger appointments_guard_commitment
before insert or update of status, therapist_id, service_id, starts_at, ends_at, session_mode, archived_at
on public.appointments for each row execute function public.guard_confirmed_appointment();

create or replace function public.mark_payment_status(
  p_reference text, p_new_status public.payment_status,
  p_provider_reference text default null, p_failed_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  group_ref text;
  problem text;
begin
  select coalesce(checkout_group_reference, reference) into group_ref
    from public.payments where reference = p_reference;
  if group_ref is null then raise exception using errcode = 'P0001', message = 'payment_not_found'; end if;
  perform id from public.payments where reference = group_ref or checkout_group_reference = group_ref order by id for update;
  select * into p from public.payments where reference = p_reference;
  -- Delayed failures and duplicate callbacks must not undo a verified payment.
  if p.status = 'refunded' or (p.status = 'succeeded' and p_new_status <> 'refunded') then return p; end if;
  update public.payments set status = p_new_status,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    failed_reason = case when p_new_status = 'succeeded' then null else coalesce(p_failed_reason, failed_reason) end,
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    verified_by = case when p_new_status in ('succeeded', 'refunded') then auth.uid() else verified_by end,
    verified_at = case when p_new_status in ('succeeded', 'refunded') then now() else verified_at end,
    updated_at = now()
    where reference = group_ref or checkout_group_reference = group_ref;

  if p_new_status = 'succeeded' then
    begin
      perform t.id from public.therapists t where t.id in (
        select a.therapist_id from public.appointments a join public.payments pay on pay.appointment_id = a.id
        where pay.reference = group_ref or pay.checkout_group_reference = group_ref
      ) order by t.id for update;
      if exists (select 1 from public.appointments a join public.payments pay on pay.appointment_id = a.id
        where (pay.reference = group_ref or pay.checkout_group_reference = group_ref)
          and (a.status not in ('hold', 'pending_payment') or a.archived_at is not null))
      then raise exception using errcode = 'P0001', message = 'slot_unavailable'; end if;
      update public.appointments a set status = 'confirmed', hold_expires_at = null,
        paid_amount_kobo = pay.amount_kobo, payment_reference = group_ref, updated_at = now()
        from public.payments pay where a.id = pay.appointment_id
          and (pay.reference = group_ref or pay.checkout_group_reference = group_ref);
    exception when exclusion_violation or sqlstate 'P0001' then
      get stacked diagnostics problem = message_text;
      if sqlstate = 'P0001' and problem <> 'slot_unavailable' then raise; end if;
      -- The payment stays succeeded; the appointment is not confirmed or emailed as booked.
      update public.payments set metadata = metadata || jsonb_build_object(
        'booking_review_required', true, 'booking_review_reason', 'slot_unavailable')
        where reference = group_ref or checkout_group_reference = group_ref;
    end;
  end if;
  select * into p from public.payments where reference = p_reference;
  return p;
end $$;
revoke all on function public.mark_payment_status(text, public.payment_status, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mark_payment_status(text, public.payment_status, text, text, jsonb) to service_role;

create or replace function public.list_available_slots(
  p_service_id uuid, p_from date, p_to date, p_mode public.session_mode default null
) returns table (therapist_id uuid, starts_at timestamptz, ends_at timestamptz, mode public.session_mode)
language sql stable security definer set search_path = public, extensions
as $$
  with selected_service as (
    select * from public.services
    where public.services.id = p_service_id and public.services.is_active
  ),
  days as (select generate_series(p_from, p_to, interval '1 day')::date as day where p_from <= p_to),
  recurring_windows as (
    select rule.therapist_id,
      ((days.day::timestamp + rule.starts_at) at time zone rule.timezone) as window_start,
      ((days.day::timestamp + rule.ends_at) at time zone rule.timezone) as window_end,
      rule.mode
    from public.availability_rules rule
    join public.therapist_services assignment on assignment.therapist_id = rule.therapist_id and assignment.service_id = p_service_id
    join public.therapists therapist on therapist.id = rule.therapist_id and therapist.is_active
    cross join days
    where rule.is_active and extract(dow from days.day) = rule.day_of_week
      and (p_mode is null or rule.mode = p_mode)
  ),
  added_windows as (
    select exception.therapist_id, exception.starts_at as window_start, exception.ends_at as window_end,
      coalesce(exception.mode, p_mode, 'online'::public.session_mode) as mode
    from public.availability_exceptions exception
    join public.therapist_services assignment on assignment.therapist_id = exception.therapist_id and assignment.service_id = p_service_id
    join public.therapists therapist on therapist.id = exception.therapist_id and therapist.is_active
    where exception.kind = 'added'
      and timezone('Africa/Lagos', exception.starts_at)::date between p_from and p_to
      and (p_mode is null or exception.mode is null or exception.mode = p_mode)
  ),
  windows as (select * from recurring_windows union all select * from added_windows),
  candidate_slots as (
    select windows.therapist_id, slot.starts_at,
      slot.starts_at + make_interval(mins => selected_service.duration_minutes) as ends_at,
      windows.mode, selected_service.buffer_before_minutes, selected_service.buffer_after_minutes, selected_service.minimum_lead_time_minutes
    from windows cross join selected_service
    cross join lateral generate_series(windows.window_start, windows.window_end - make_interval(mins => selected_service.duration_minutes), interval '15 minutes') as slot(starts_at)
  )
  select candidate.therapist_id, candidate.starts_at, candidate.ends_at, candidate.mode
  from candidate_slots candidate
  where candidate.starts_at >= now() + make_interval(mins => candidate.minimum_lead_time_minutes)
    and not exists (
      select 1 from public.availability_exceptions blocked
      where blocked.therapist_id = candidate.therapist_id and blocked.kind = 'blocked'
        and (blocked.mode is null or blocked.mode = candidate.mode)
        and tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes), '[)')
    )
    and not exists (
      select 1 from public.appointments appointment
      join public.services booked_service on booked_service.id = appointment.service_id
      where appointment.therapist_id = candidate.therapist_id
        and appointment.status = 'confirmed'
        and appointment.archived_at is null
        and tstzrange(
          appointment.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
          appointment.ends_at + make_interval(mins => booked_service.buffer_after_minutes), '[)') &&
          tstzrange(
            candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
            candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes), '[)')
    )
  order by candidate.starts_at, candidate.therapist_id;
$$;
