-- Track multi-session package purchases and let clients schedule remaining
-- sessions from a bearer booking link.

do $$
begin
  create type public.session_package_status as enum ('active', 'exhausted', 'expired', 'void');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.client_session_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id) on delete set null,
  client_name text not null check (length(trim(client_name)) between 2 and 100),
  client_email text not null check (length(trim(client_email)) between 3 and 255),
  client_phone text check (client_phone is null or length(trim(client_phone)) between 7 and 20),
  service_id uuid not null references public.services(id) on delete restrict,
  source_payment_id uuid unique references public.payments(id) on delete set null,
  purchased_sessions integer not null check (purchased_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  status public.session_package_status not null default 'active',
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  access_token text,
  expires_at timestamptz,
  notes text check (notes is null or length(trim(notes)) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_sessions <= purchased_sessions)
);

alter table public.client_session_packages enable row level security;

create index if not exists client_session_packages_client_email_idx
  on public.client_session_packages (lower(client_email), created_at desc);
create index if not exists client_session_packages_service_idx
  on public.client_session_packages (service_id, status);
create index if not exists client_session_packages_token_idx
  on public.client_session_packages (access_token_hash)
  where status = 'active';

drop policy if exists client_session_packages_staff_read on public.client_session_packages;
create policy client_session_packages_staff_read
on public.client_session_packages for select
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

drop policy if exists client_session_packages_client_read_own on public.client_session_packages;
create policy client_session_packages_client_read_own
on public.client_session_packages for select
to authenticated
using (client_id = auth.uid());

grant select on public.client_session_packages to authenticated;
grant all on public.client_session_packages to service_role;

drop trigger if exists client_session_packages_set_updated_at on public.client_session_packages;
create trigger client_session_packages_set_updated_at
before update on public.client_session_packages
for each row execute function public.set_updated_at();

alter table public.appointments
  add column if not exists package_id uuid references public.client_session_packages(id) on delete set null;

create index if not exists appointments_package_idx
  on public.appointments (package_id, starts_at desc);

create or replace function public.session_package_is_active(
  p_package public.client_session_packages
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_package.status = 'active'
     and p_package.used_sessions < p_package.purchased_sessions
     and (p_package.expires_at is null or p_package.expires_at > now());
$$;

revoke all on function public.session_package_is_active(public.client_session_packages) from public;
grant execute on function public.session_package_is_active(public.client_session_packages)
  to anon, authenticated, service_role;

create or replace function public.get_session_package_by_token(
  p_access_token_hash text
) returns table(
  id uuid,
  client_name text,
  client_email text,
  client_phone text,
  service_id uuid,
  service_name text,
  purchased_sessions integer,
  used_sessions integer,
  remaining_sessions integer,
  status public.session_package_status,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pkg.id,
    pkg.client_name,
    pkg.client_email,
    pkg.client_phone,
    pkg.service_id,
    svc.name as service_name,
    pkg.purchased_sessions,
    pkg.used_sessions,
    greatest(pkg.purchased_sessions - pkg.used_sessions, 0) as remaining_sessions,
    case
      when pkg.status = 'active'
       and (pkg.expires_at is not null and pkg.expires_at <= now())
        then 'expired'::public.session_package_status
      when pkg.status = 'active'
       and pkg.used_sessions >= pkg.purchased_sessions
        then 'exhausted'::public.session_package_status
      else pkg.status
    end as status,
    pkg.expires_at
  from public.client_session_packages pkg
  join public.services svc on svc.id = pkg.service_id
  where pkg.access_token_hash = lower(trim(p_access_token_hash))
  limit 1;
$$;

revoke all on function public.get_session_package_by_token(text) from public;
grant execute on function public.get_session_package_by_token(text)
  to anon, authenticated, service_role;

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
  set used_sessions = used_sessions + 1,
      status = case
        when used_sessions + 1 >= purchased_sessions
          then 'exhausted'::public.session_package_status
        else status
      end,
      updated_at = now()
  where id = pkg.id
  returning * into pkg;

  update public.appointments
  set package_id = pkg.id,
      status = 'confirmed'::public.appointment_status,
      hold_expires_at = null,
      paid_amount_kobo = coalesce(paid_amount_kobo, 0),
      payment_reference = coalesce(payment_reference, 'PACKAGE-' || upper(substr(pkg.id::text, 1, 8))),
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
      0,
      'active',
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      now() + interval '6 months',
      auth.uid()
    )
    returning * into pkg;
  end if;

  if appt.package_id is null and pkg.used_sessions < pkg.purchased_sessions then
    update public.client_session_packages
    set used_sessions = used_sessions + 1,
        status = case
          when used_sessions + 1 >= purchased_sessions
            then 'exhausted'::public.session_package_status
          else status
        end,
        updated_at = now()
    where id = pkg.id
    returning * into pkg;

    update public.appointments
    set package_id = pkg.id,
        updated_at = now()
    where id = appt.id;
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

insert into public.email_template_settings (template_key, display_name, description, is_enabled)
values (
  'package_booking_link',
  'Package booking link',
  'Sent when a client can schedule remaining sessions from a paid package.',
  true
)
on conflict (template_key) do nothing;

drop function if exists public.get_appointment_by_manage_token(text);

create or replace function public.get_appointment_by_manage_token(p_manage_token_hash text)
returns table(
  id uuid, booking_reference text, status appointment_status,
  starts_at timestamptz, ends_at timestamptz, session_mode session_mode,
  client_name text, client_email text, client_phone text,
  service_id uuid, therapist_id uuid, hold_expires_at timestamptz,
  cancelled_at timestamptz, package_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.booking_reference, a.status, a.starts_at, a.ends_at, a.session_mode,
    a.client_name, a.client_email, a.client_phone, a.service_id, a.therapist_id,
    a.hold_expires_at, a.cancelled_at, a.package_id
  from public.appointments a
  where a.manage_token_hash = lower(trim(p_manage_token_hash))
    and public.appointment_manage_token_is_active(a)
  limit 1;
$$;

revoke all on function public.get_appointment_by_manage_token(text) from public;
grant execute on function public.get_appointment_by_manage_token(text)
  to anon, authenticated, service_role;
