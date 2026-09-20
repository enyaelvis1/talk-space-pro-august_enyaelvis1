-- Align client self-service reschedule/cancellation cutoff with the published
-- 48-hour policy and autoresponder copy.

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz,
  p_manage_token_hash text default null,
  p_new_therapist_id uuid default null,
  p_new_session_mode session_mode default null
) returns table(
  id uuid, booking_reference text, starts_at timestamptz, ends_at timestamptz, status appointment_status
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  appt public.appointments%rowtype;
  actor text;
  target_therapist uuid;
  target_mode session_mode;
  service_duration integer;
  new_ends timestamptz;
begin
  select * into appt from public.appointments where public.appointments.id = p_appointment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  if actor is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  if appt.status not in ('hold','pending_payment','confirmed') then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;

  if actor in ('client_owner','manage_token') and appt.starts_at < now() + interval '48 hours' then
    raise exception using errcode = 'P0001', message = 'too_late';
  end if;

  target_therapist := coalesce(p_new_therapist_id, appt.therapist_id);
  target_mode := coalesce(p_new_session_mode, appt.session_mode);

  select duration_minutes into service_duration from public.services where public.services.id = appt.service_id;
  new_ends := p_new_starts_at + make_interval(mins => service_duration);

  if p_new_starts_at < now() or extract(minute from (p_new_starts_at at time zone 'Africa/Lagos'))::int % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'invalid_slot';
  end if;

  update public.appointments set status = 'cancelled', updated_at = now()
    where public.appointments.id = appt.id;

  if not exists (
    select 1 from public.list_available_slots(appt.service_id,
      (p_new_starts_at at time zone 'Africa/Lagos')::date,
      (p_new_starts_at at time zone 'Africa/Lagos')::date, target_mode) av
    where av.therapist_id = target_therapist and av.starts_at = p_new_starts_at
      and av.ends_at = new_ends and av.mode = target_mode
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  update public.appointments set
    status = appt.status,
    starts_at = p_new_starts_at,
    ends_at = new_ends,
    therapist_id = target_therapist,
    session_mode = target_mode,
    rescheduled_from_starts_at = coalesce(appt.rescheduled_from_starts_at, appt.starts_at),
    hold_expires_at = case when appt.status = 'hold' then now() + interval '5 minutes' else null end,
    updated_at = now()
  where public.appointments.id = appt.id
  returning public.appointments.id, public.appointments.booking_reference,
    public.appointments.starts_at, public.appointments.ends_at, public.appointments.status
  into id, booking_reference, starts_at, ends_at, status;
  return next;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;

revoke all on function public.reschedule_appointment(uuid, timestamptz, text, uuid, session_mode) from public;
grant execute on function public.reschedule_appointment(uuid, timestamptz, text, uuid, session_mode)
  to anon, authenticated, service_role;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null,
  p_manage_token_hash text default null
) returns table(id uuid, status appointment_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments%rowtype;
  actor text;
begin
  select * into appt from public.appointments where public.appointments.id = p_appointment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  if actor is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  if appt.status in ('cancelled','completed','no_show') then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;

  if actor in ('client_owner','manage_token') and appt.starts_at < now() + interval '48 hours'
     and appt.status <> 'hold' then
    raise exception using errcode = 'P0001', message = 'too_late';
  end if;

  update public.appointments set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancel_reason = nullif(trim(p_reason), ''),
    hold_expires_at = null,
    manage_token = null,
    manage_token_revoked_at = coalesce(manage_token_revoked_at, now()),
    manage_token_revoked_by = coalesce(manage_token_revoked_by, auth.uid()),
    manage_token_revocation_reason = coalesce(
      manage_token_revocation_reason,
      'status_cancelled'
    ),
    updated_at = now()
  where public.appointments.id = appt.id
  returning public.appointments.id, public.appointments.status
  into id, status;
  return next;
end;
$$;

revoke all on function public.cancel_appointment(uuid, text, text) from public;
grant execute on function public.cancel_appointment(uuid, text, text)
  to anon, authenticated, service_role;
