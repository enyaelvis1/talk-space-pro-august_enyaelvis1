-- Prevent new recurring rules from creating duplicate slots while preserving
-- existing rows for an explicit, audited cleanup after their source is known.
-- Recurring rule times are wall-clock values in the rule timezone; the booking
-- query converts them to timestamptz exactly once.

create or replace function public.prevent_overlapping_availability_rules()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate_range tsrange := tsrange(
    ('2000-01-01'::date + new.starts_at)::timestamp,
    ('2000-01-01'::date + new.ends_at)::timestamp,
    '[)'
  );
begin
  if new.is_active then
    -- Serialize writes for the same therapist/day/timezone so two concurrent
    -- admin requests cannot both pass the overlap check.
    perform pg_advisory_xact_lock(
      hashtextextended(
        new.therapist_id::text || ':' || new.day_of_week::text || ':' || new.timezone,
        0
      )
    );

    if exists (
      select 1
      from public.availability_rules existing
      where existing.id <> new.id
        and existing.therapist_id = new.therapist_id
        and existing.day_of_week = new.day_of_week
        and existing.timezone = new.timezone
        and existing.mode = new.mode
        and existing.is_active
        and tsrange(
          ('2000-01-01'::date + existing.starts_at)::timestamp,
          ('2000-01-01'::date + existing.ends_at)::timestamp,
          '[)'
        ) && candidate_range
    ) then
      raise exception using
        errcode = '23P01',
        message = 'availability_rule_overlap';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists availability_rules_prevent_overlap on public.availability_rules;
create trigger availability_rules_prevent_overlap
before insert or update of therapist_id, day_of_week, starts_at, ends_at, mode, timezone, is_active
on public.availability_rules
for each row execute function public.prevent_overlapping_availability_rules();

-- Legacy duplicate rules are retained until their source, exceptions, linked
-- bookings, and audit history are reviewed. The result boundary is defensive:
-- the same therapist/mode/instant is returned once even before cleanup.
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
  ),
  eligible_slots as (
    select distinct on (candidate.therapist_id, candidate.starts_at, candidate.mode)
      candidate.*
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
    order by candidate.therapist_id, candidate.starts_at, candidate.mode
  )
  select therapist_id, starts_at, ends_at, mode
  from eligible_slots
  order by starts_at, therapist_id;
$$;
