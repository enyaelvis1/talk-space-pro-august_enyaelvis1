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
        and appointment.status in ('hold','pending_payment','confirmed')
        and (appointment.status <> 'hold' or appointment.hold_expires_at > now())
        and tstzrange(
          appointment.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
          appointment.ends_at + make_interval(mins => booked_service.buffer_after_minutes), '[)') &&
          tstzrange(
            candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
            candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes), '[)')
    )
  order by candidate.starts_at, candidate.therapist_id;
$$;

create or replace function public.hold_appointment(
  p_service_id uuid, p_therapist_id uuid, p_session_mode public.session_mode, p_starts_at timestamptz,
  p_client_name text, p_client_email text, p_client_phone text, p_notes text, p_manage_token_hash text,
  p_client_id uuid default null
) returns table (id uuid, booking_reference text, hold_expires_at timestamptz, starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  service_record public.services%rowtype;
  appointment_id uuid;
  reference text;
  appointment_end timestamptz;
begin
  if p_client_id is not null and (auth.uid() is null or p_client_id <> auth.uid()) then
    raise exception using errcode = 'P0001', message = 'invalid_client';
  end if;
  if p_starts_at < now() or extract(minute from (p_starts_at at time zone 'Africa/Lagos'))::integer % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'invalid_slot';
  end if;
  select * into service_record from public.services where public.services.id = p_service_id and public.services.is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_unavailable';
  end if;
  appointment_end := p_starts_at + make_interval(mins => service_record.duration_minutes);
  if not exists (
    select 1 from public.list_available_slots(p_service_id,
      (p_starts_at at time zone 'Africa/Lagos')::date,
      (p_starts_at at time zone 'Africa/Lagos')::date, p_session_mode) available
    where available.therapist_id = p_therapist_id
      and available.starts_at = p_starts_at
      and available.ends_at = appointment_end
      and available.mode = p_session_mode
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;
  update public.appointments set status = 'cancelled', updated_at = now()
  where public.appointments.status = 'hold' and public.appointments.hold_expires_at <= now();
  reference := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.appointments (
    booking_reference, client_id, client_name, client_email, client_phone,
    therapist_id, service_id, session_mode, starts_at, ends_at, hold_expires_at, manage_token_hash, notes
  ) values (
    reference, p_client_id, trim(p_client_name), lower(trim(p_client_email)), trim(p_client_phone),
    p_therapist_id, p_service_id, p_session_mode, p_starts_at, appointment_end,
    now() + interval '5 minutes', lower(trim(p_manage_token_hash)), nullif(trim(p_notes), '')
  )
  returning public.appointments.id, public.appointments.booking_reference,
    public.appointments.hold_expires_at, public.appointments.starts_at, public.appointments.ends_at
  into appointment_id, reference, hold_expires_at, starts_at, ends_at;
  id := appointment_id;
  booking_reference := reference;
  return next;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;