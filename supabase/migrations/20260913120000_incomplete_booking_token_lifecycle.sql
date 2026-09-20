-- Checkout authority lasts five minutes, even after a payment is initiated.
-- Paid management links retain their existing post-session lifetime. No CMS writes.
create or replace function public.booking_checkout_deadline(a public.appointments)
returns timestamptz language sql stable set search_path = public as $$
  select least(a.created_at + interval '5 minutes', a.hold_expires_at, a.manage_token_expires_at);
$$;

create or replace function public.appointment_manage_token_is_active(p_appointment public.appointments)
returns boolean language sql stable security definer set search_path = public as $$
  select p_appointment.manage_token_hash is not null
    and p_appointment.manage_token_revoked_at is null
    and p_appointment.status not in ('cancelled', 'completed', 'no_show')
    and case when p_appointment.status in ('hold', 'pending_payment')
      then public.booking_checkout_deadline(p_appointment) > now()
      else p_appointment.manage_token_expires_at > now() end;
$$;

create or replace function public.apply_appointment_manage_token_lifecycle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.package_id is distinct from old.package_id and new.package_id is not null
      and old.status <> 'confirmed' and
      (old.status not in ('hold', 'pending_payment') or
       not coalesce(public.appointment_manage_token_is_active(old), false)) then
      raise exception using errcode = 'P0001', message = 'checkout_expired';
    end if;
    if new.status = 'confirmed' and old.status in ('hold', 'pending_payment')
      and public.booking_checkout_deadline(old) <= now() then
      new.status := 'cancelled';
      new.cancelled_at := now();
      new.hold_expires_at := null;
      new.manage_token_revoked_at := coalesce(old.manage_token_revoked_at, now());
      new.manage_token_revocation_reason := 'checkout_expired';
    end if;
  end if;
  if new.status in ('hold', 'pending_payment') then
    new.manage_token_expires_at := public.booking_checkout_deadline(new);
  elsif new.status = 'confirmed' and new.manage_token_revoked_at is null then
    if tg_op = 'INSERT' then
      new.manage_token_expires_at := coalesce(new.manage_token_expires_at,
        greatest(new.ends_at, now()) + interval '30 days');
    elsif old.status in ('hold', 'pending_payment') or new.manage_token_hash is distinct from old.manage_token_hash then
      new.manage_token_expires_at := greatest(new.ends_at, now()) + interval '30 days';
    end if;
  end if;
  -- Rescheduling temporarily writes cancelled without cancelled_at. Do not revoke
  -- that intermediate state; explicit cancellation and expiry revoke separately.
  if new.status in ('completed', 'no_show') or
      (new.status = 'cancelled' and new.cancelled_at is not null) then
    new.manage_token := null;
    new.manage_token_revoked_at := coalesce(new.manage_token_revoked_at, now());
    new.manage_token_revocation_reason := coalesce(new.manage_token_revocation_reason, 'status_' || new.status::text);
  end if;
  return new;
end;
$$;

-- Package credit consumption also updates package_id; always apply the guard.
drop trigger if exists appointments_manage_token_lifecycle on public.appointments;
create trigger appointments_manage_token_lifecycle
before insert or update of status, starts_at, ends_at, manage_token_hash,
  manage_token_expires_at, package_id on public.appointments
for each row execute function public.apply_appointment_manage_token_lifecycle();

create or replace function public.appointment_actor(p_appointment public.appointments, p_manage_token_hash text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null and public.has_role(auth.uid(), 'admin') then 'admin'
    when auth.uid() is not null and public.has_role(auth.uid(), 'staff') then 'staff'
    when p_appointment.status in ('hold', 'pending_payment')
      and not coalesce(public.appointment_manage_token_is_active(p_appointment), false) then null
    when auth.uid() is not null and p_appointment.client_id = auth.uid() then 'client_owner'
    when p_manage_token_hash is not null and lower(trim(p_manage_token_hash)) = p_appointment.manage_token_hash
      and public.appointment_manage_token_is_active(p_appointment) then 'manage_token'
    else null end;
$$;

create or replace function public.expire_stale_holds() returns integer
language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.appointments a set status = 'cancelled', hold_expires_at = null,
    cancelled_at = coalesce(a.cancelled_at, now()), updated_at = now(),
    manage_token = null, manage_token_revoked_at = coalesce(a.manage_token_revoked_at, now()),
    manage_token_revocation_reason = coalesce(a.manage_token_revocation_reason, 'hold_expired')
  where a.status in ('hold', 'pending_payment')
    and public.booking_checkout_deadline(a) <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Cleanup before the exclusion constraint is checked, including direct RPC holds.
create or replace function public.cleanup_before_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.expire_stale_holds();
  return new;
end;
$$;
drop trigger if exists appointments_cleanup_expired_checkout on public.appointments;
create trigger appointments_cleanup_expired_checkout
before insert on public.appointments for each statement
execute function public.cleanup_before_booking_insert();

-- Service-role checkout writes also need a locked, fresh authorization check.
create or replace function public.guard_payment_checkout_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  if new.status in ('initiated', 'awaiting_confirmation') then
    select * into a from public.appointments where id = new.appointment_id for update;
    if not found or a.status not in ('hold', 'pending_payment') or
      not coalesce(public.appointment_manage_token_is_active(a), false) then
      raise exception using errcode = 'P0001', message = 'checkout_expired';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists payments_guard_checkout_insert on public.payments;
create trigger payments_guard_checkout_insert before insert on public.payments
for each row execute function public.guard_payment_checkout_insert();

-- A booking bearer token or ordinary account must never be able to mark money paid.
revoke all on function public.mark_payment_status(text, public.payment_status, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_payment_status(text, public.payment_status, text, text, jsonb)
  to service_role;

create or replace function public.list_available_slots(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_mode public.session_mode default null
)
returns table (
  therapist_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  mode public.session_mode
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with selected_service as (
    select *
    from public.services
    where public.services.id = p_service_id
      and public.services.is_active
  ),
  days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
    where p_from <= p_to
  ),
  recurring_windows as (
    select
      rule.therapist_id,
      ((days.day::timestamp + rule.starts_at) at time zone rule.timezone) as window_start,
      ((days.day::timestamp + rule.ends_at) at time zone rule.timezone) as window_end,
      rule.mode
    from public.availability_rules rule
    join public.therapist_services assignment
      on assignment.therapist_id = rule.therapist_id
     and assignment.service_id = p_service_id
    join public.therapists therapist
      on therapist.id = rule.therapist_id
     and therapist.is_active
    cross join days
    where rule.is_active
      and extract(dow from days.day) = rule.day_of_week
      and (p_mode is null or rule.mode = p_mode)
  ),
  added_windows as (
    select
      exception.therapist_id,
      exception.starts_at as window_start,
      exception.ends_at as window_end,
      coalesce(exception.mode, p_mode, 'online'::public.session_mode) as mode
    from public.availability_exceptions exception
    join public.therapist_services assignment
      on assignment.therapist_id = exception.therapist_id
     and assignment.service_id = p_service_id
    join public.therapists therapist
      on therapist.id = exception.therapist_id
     and therapist.is_active
    where exception.kind = 'added'
      and timezone('Africa/Lagos', exception.starts_at)::date between p_from and p_to
      and (p_mode is null or exception.mode is null or exception.mode = p_mode)
  ),
  windows as (
    select * from recurring_windows
    union all
    select * from added_windows
  ),
  candidate_slots as (
    select
      windows.therapist_id,
      slot.starts_at,
      slot.starts_at + make_interval(mins => selected_service.duration_minutes) as ends_at,
      windows.mode,
      selected_service.buffer_before_minutes,
      selected_service.buffer_after_minutes,
      selected_service.minimum_lead_time_minutes
    from windows
    cross join selected_service
    cross join lateral generate_series(
      windows.window_start,
      windows.window_end - make_interval(mins => selected_service.duration_minutes),
      interval '15 minutes'
    ) as slot(starts_at)
  )
  select
    candidate.therapist_id,
    candidate.starts_at,
    candidate.ends_at,
    candidate.mode
  from candidate_slots candidate
  where candidate.starts_at >= now() + make_interval(mins => candidate.minimum_lead_time_minutes)
    and not exists (
      select 1
      from public.availability_exceptions blocked
      where blocked.therapist_id = candidate.therapist_id
        and blocked.kind = 'blocked'
        and (blocked.mode is null or blocked.mode = candidate.mode)
        and tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes),
          '[)'
        )
    )
    and not exists (
      select 1
      from public.appointments appointment
      join public.services booked_service on booked_service.id = appointment.service_id
      where appointment.therapist_id = candidate.therapist_id
        and appointment.status in ('hold', 'pending_payment', 'confirmed')
        and (appointment.status = 'confirmed' or public.booking_checkout_deadline(appointment) > now())
        and tstzrange(
          appointment.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
          appointment.ends_at + make_interval(mins => booked_service.buffer_after_minutes),
          '[)'
        ) && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes),
          '[)'
        )
    )
  order by candidate.starts_at, candidate.therapist_id;
$$;
