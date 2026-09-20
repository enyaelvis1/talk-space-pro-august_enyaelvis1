-- Minimal disposable schema; never run against an application database.
create schema auth;
create schema extensions;
create extension btree_gist with schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid;
$$;
create function public.has_role(uuid, text) returns boolean language sql stable as $$ select false; $$;
create type public.session_mode as enum ('online', 'in_person');
create type public.appointment_status as enum ('hold', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.payment_status as enum ('initiated', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled', 'refunded');
create table public.services(id uuid primary key, is_active boolean default true, duration_minutes integer default 60,
  buffer_before_minutes integer default 0, buffer_after_minutes integer default 0, minimum_lead_time_minutes integer default 0);
create table public.therapists(id uuid primary key, is_active boolean default true);
create table public.therapist_services(therapist_id uuid, service_id uuid);
create table public.availability_rules(therapist_id uuid, starts_at time, ends_at time, timezone text, mode public.session_mode, day_of_week int, is_active boolean);
create table public.availability_exceptions(therapist_id uuid, starts_at timestamptz, ends_at timestamptz, mode public.session_mode, kind text);
create table public.appointments(
  id uuid primary key default gen_random_uuid(), booking_reference text unique not null,
  client_id uuid, client_name text, client_email text, client_phone text, therapist_id uuid, service_id uuid,
  session_mode public.session_mode default 'online', starts_at timestamptz not null, ends_at timestamptz not null,
  status public.appointment_status default 'hold', hold_expires_at timestamptz,
  manage_token_hash text, manage_token text, cancelled_at timestamptz, cancelled_by uuid, cancel_reason text,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz default now(),
  paid_amount_kobo bigint, payment_reference text, package_id uuid,
  check(status = 'hold' or hold_expires_at is null), check(status <> 'hold' or hold_expires_at is not null)
);
set search_path = public, extensions;
alter table public.appointments add constraint active_slot_exclusion exclude using gist
  (therapist_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where(status in ('hold', 'pending_payment', 'confirmed'));
create table public.payments(id uuid primary key default gen_random_uuid(), appointment_id uuid,
  reference text unique, status public.payment_status, amount_kobo bigint, provider_reference text,
  failed_reason text, metadata jsonb default '{}', verified_by uuid, verified_at timestamptz, updated_at timestamptz);
