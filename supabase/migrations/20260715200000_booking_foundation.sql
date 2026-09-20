-- Batch E: transactional booking foundation and real availability.

create type public.appointment_status as enum (
  'hold',
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create extension if not exists btree_gist with schema extensions;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null check (length(trim(client_name)) between 2 and 100),
  client_email text not null check (length(trim(client_email)) between 3 and 255),
  client_phone text not null check (length(trim(client_phone)) between 7 and 20),
  therapist_id uuid not null references public.therapists(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  session_mode public.session_mode not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'hold',
  hold_expires_at timestamptz,
  manage_token_hash text not null check (manage_token_hash ~ '^[0-9a-f]{64}$'),
  notes text check (notes is null or length(trim(notes)) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (status <> 'hold' or hold_expires_at is not null),
  check (status = 'hold' or hold_expires_at is null)
);

create index appointments_client_created_idx
  on public.appointments (client_id, created_at desc);
create index appointments_status_created_idx
  on public.appointments (status, created_at desc);

alter table public.appointments
  add constraint appointments_active_slot_exclusion
  exclude using gist (
    therapist_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('hold', 'pending_payment', 'confirmed'));

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

grant select on public.appointments to authenticated;

create policy appointments_client_read_own
on public.appointments for select
to authenticated
using (
  client_id = auth.uid()
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'staff')
);

-- Seed predictable weekly windows for the therapists already present in Batch D.
-- Times are stored in the therapist rule's default Africa/Lagos timezone.
insert into public.availability_rules (
  therapist_id,
  day_of_week,
  starts_at,
  ends_at,
  mode
)
select
  therapist.id,
  day_of_week,
  time '09:00',
  time '17:00',
  'online'::public.session_mode
from public.therapists therapist
cross join generate_series(1, 5) as weekdays(day_of_week)
where therapist.is_active
  and not exists (
    select 1
    from public.availability_rules existing
    where existing.therapist_id = therapist.id
      and existing.day_of_week = weekdays.day_of_week
      and existing.starts_at = time '09:00'
      and existing.ends_at = time '17:00'
      and existing.mode = 'online'::public.session_mode
  );

insert into public.availability_rules (
  therapist_id,
  day_of_week,
  starts_at,
  ends_at,
  mode
)
select
  therapist.id,
  day_of_week,
  time '10:00',
  time '16:00',
  'in_person'::public.session_mode
from public.therapists therapist
cross join generate_series(1, 4) as weekdays(day_of_week)
where therapist.slug in ('amara-okoro', 'ngozi-balogun')
  and therapist.is_active
  and not exists (
    select 1
    from public.availability_rules existing
    where existing.therapist_id = therapist.id
      and existing.day_of_week = weekdays.day_of_week
      and existing.starts_at = time '10:00'
      and existing.ends_at = time '16:00'
      and existing.mode = 'in_person'::public.session_mode
  );

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
    where id = p_service_id
      and is_active
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
        and (appointment.status <> 'hold' or appointment.hold_expires_at > now())
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

grant execute on function public.list_available_slots(uuid, date, date, public.session_mode)
to anon, authenticated;

create or replace function public.hold_appointment(
  p_service_id uuid,
  p_therapist_id uuid,
  p_session_mode public.session_mode,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_notes text,
  p_manage_token_hash text,
  p_client_id uuid default null
)
returns table (
  id uuid,
  booking_reference text,
  hold_expires_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
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

  if p_starts_at < now()
     or extract(minute from (p_starts_at at time zone 'Africa/Lagos'))::integer % 15 <> 0
  then
    raise exception using errcode = 'P0001', message = 'invalid_slot';
  end if;

  select * into service_record
  from public.services
  where id = p_service_id
    and is_active;

  if not found then
    raise exception using errcode = 'P0001', message = 'service_unavailable';
  end if;

  appointment_end := p_starts_at + make_interval(mins => service_record.duration_minutes);

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

  update public.appointments
  set status = 'cancelled', updated_at = now()
  where status = 'hold'
    and hold_expires_at <= now();

  reference := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  insert into public.appointments (
    booking_reference,
    client_id,
    client_name,
    client_email,
    client_phone,
    therapist_id,
    service_id,
    session_mode,
    starts_at,
    ends_at,
    hold_expires_at,
    manage_token_hash,
    notes
  )
  values (
    reference,
    p_client_id,
    trim(p_client_name),
    lower(trim(p_client_email)),
    trim(p_client_phone),
    p_therapist_id,
    p_service_id,
    p_session_mode,
    p_starts_at,
    appointment_end,
    now() + interval '5 minutes',
    lower(trim(p_manage_token_hash)),
    nullif(trim(p_notes), '')
  )
  returning public.appointments.id, public.appointments.booking_reference,
    public.appointments.hold_expires_at, public.appointments.starts_at,
    public.appointments.ends_at
  into appointment_id, reference, hold_expires_at, starts_at, ends_at;

  id := appointment_id;
  booking_reference := reference;
  return next;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;

grant execute on function public.hold_appointment(
  uuid,
  uuid,
  public.session_mode,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  uuid
) to anon, authenticated;
