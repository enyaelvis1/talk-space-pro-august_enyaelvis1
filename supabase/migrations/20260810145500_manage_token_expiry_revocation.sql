-- Add an explicit lifecycle for booking manage links. Tokens remain hashed for
-- authorization, but the bearer link can now expire or be revoked by admins.

alter table public.appointments
  add column if not exists manage_token_expires_at timestamptz,
  add column if not exists manage_token_revoked_at timestamptz,
  add column if not exists manage_token_revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists manage_token_revocation_reason text;

update public.appointments
set manage_token_expires_at = greatest(coalesce(ends_at, starts_at), now()) + interval '30 days'
where manage_token_expires_at is null;

update public.appointments
set manage_token_revoked_at = coalesce(cancelled_at, updated_at, now()),
    manage_token_revocation_reason = coalesce(
      manage_token_revocation_reason,
      'status_' || status::text
    )
where status in ('cancelled', 'completed', 'no_show')
  and manage_token_revoked_at is null;

create index if not exists appointments_manage_token_active_idx
  on public.appointments (manage_token_hash, manage_token_expires_at)
  where manage_token_revoked_at is null;

create or replace function public.appointment_manage_token_is_active(
  p_appointment public.appointments
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_appointment.manage_token_hash is not null
     and p_appointment.manage_token_revoked_at is null
     and (
       p_appointment.manage_token_expires_at is null
       or p_appointment.manage_token_expires_at > now()
     )
     and p_appointment.status not in ('cancelled', 'completed', 'no_show');
$$;

revoke all on function public.appointment_manage_token_is_active(public.appointments) from public;
grant execute on function public.appointment_manage_token_is_active(public.appointments)
  to anon, authenticated, service_role;

create or replace function public.apply_appointment_manage_token_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expiry_base timestamptz;
begin
  expiry_base := greatest(coalesce(new.ends_at, new.starts_at), now());

  if tg_op = 'INSERT' then
    if new.manage_token_expires_at is null then
      new.manage_token_expires_at := expiry_base + interval '30 days';
    end if;
  elsif new.manage_token_hash is distinct from old.manage_token_hash
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
  then
    if new.manage_token_expires_at is null
       or (tg_op = 'UPDATE' and new.manage_token_hash is distinct from old.manage_token_hash)
    then
      new.manage_token_expires_at := expiry_base + interval '30 days';
    end if;
  end if;

  if new.status in ('completed', 'no_show') and new.manage_token_revoked_at is null then
    new.manage_token_revoked_at := now();
    new.manage_token_revocation_reason := coalesce(
      new.manage_token_revocation_reason,
      'status_' || new.status::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_manage_token_lifecycle on public.appointments;
create trigger appointments_manage_token_lifecycle
  before insert or update of status, starts_at, ends_at, manage_token_hash, manage_token_expires_at
  on public.appointments
  for each row
  execute function public.apply_appointment_manage_token_lifecycle();

create or replace function public.appointment_actor(
  p_appointment public.appointments,
  p_manage_token_hash text
) returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is not null and public.has_role(auth.uid(), 'admin') then 'admin'
    when auth.uid() is not null and public.has_role(auth.uid(), 'staff') then 'staff'
    when auth.uid() is not null and p_appointment.client_id = auth.uid() then 'client_owner'
    when p_manage_token_hash is not null
      and lower(trim(p_manage_token_hash)) = p_appointment.manage_token_hash
      and public.appointment_manage_token_is_active(p_appointment)
      then 'manage_token'
    else null
  end;
$$;

revoke all on function public.appointment_actor(public.appointments, text) from public;
grant execute on function public.appointment_actor(public.appointments, text)
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

  if actor in ('client_owner','manage_token') and appt.starts_at < now() + interval '24 hours'
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

create or replace function public.expire_stale_holds() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.appointments set
    status = 'cancelled',
    updated_at = now(),
    hold_expires_at = null,
    manage_token = null,
    manage_token_revoked_at = coalesce(manage_token_revoked_at, now()),
    manage_token_revocation_reason = coalesce(
      manage_token_revocation_reason,
      'hold_expired'
    )
  where status = 'hold'
    and hold_expires_at is not null
    and hold_expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_stale_holds() from public;
grant execute on function public.expire_stale_holds()
  to anon, authenticated, service_role;

create or replace function public.get_appointment_by_manage_token(p_manage_token_hash text)
returns table(
  id uuid, booking_reference text, status appointment_status,
  starts_at timestamptz, ends_at timestamptz, session_mode session_mode,
  client_name text, client_email text, client_phone text,
  service_id uuid, therapist_id uuid, hold_expires_at timestamptz,
  cancelled_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.booking_reference, a.status, a.starts_at, a.ends_at, a.session_mode,
    a.client_name, a.client_email, a.client_phone, a.service_id, a.therapist_id,
    a.hold_expires_at, a.cancelled_at
  from public.appointments a
  where a.manage_token_hash = lower(trim(p_manage_token_hash))
    and public.appointment_manage_token_is_active(a)
  limit 1;
$$;

revoke all on function public.get_appointment_by_manage_token(text) from public;
grant execute on function public.get_appointment_by_manage_token(text)
  to anon, authenticated, service_role;

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
