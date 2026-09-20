create schema extensions;
create extension btree_gist with schema extensions;
create extension pgcrypto with schema extensions;
set search_path = public, extensions;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create type session_mode as enum ('online', 'in_person');
create type appointment_status as enum ('hold', 'pending_payment', 'confirmed', 'completed', 'no_show', 'cancelled');
create type payment_status as enum ('initiated', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled', 'refunded');
create type session_package_status as enum ('active', 'exhausted', 'cancelled', 'expired');
create table therapists (id uuid primary key default gen_random_uuid(), is_active boolean default true);
create table services (id uuid primary key default gen_random_uuid(), is_active boolean default true,
  duration_minutes int default 60, buffer_before_minutes int default 0, buffer_after_minutes int default 0,
  minimum_lead_time_minutes int default 0, sessions_per_package int default 4);
create table therapist_services (therapist_id uuid references therapists, service_id uuid references services);
create table availability_rules (therapist_id uuid references therapists, is_active boolean default true,
  day_of_week int, starts_at time, ends_at time, timezone text default 'Africa/Lagos', mode session_mode);
create table availability_exceptions (therapist_id uuid references therapists, kind text,
  starts_at timestamptz, ends_at timestamptz, mode session_mode);
create table appointments (id uuid primary key default gen_random_uuid(), therapist_id uuid references therapists,
  service_id uuid references services, starts_at timestamptz, ends_at timestamptz, session_mode session_mode default 'online',
  status appointment_status default 'hold', archived_at timestamptz, package_id uuid, client_id uuid,
  client_name text default 'Test Client', client_email text default 'client@example.test', client_phone text default '+2348000000000',
  updated_at timestamptz default now(), hold_expires_at timestamptz, paid_amount_kobo bigint, payment_reference text);
create table payments (id uuid primary key default gen_random_uuid(), appointment_id uuid references appointments,
  reference text unique, checkout_group_reference text, status payment_status default 'initiated',
  amount_kobo bigint default 5500000, provider_reference text, failed_reason text, metadata jsonb default '{}',
  verified_by uuid, verified_at timestamptz, updated_at timestamptz default now());
create table client_session_packages (id uuid primary key default gen_random_uuid(), client_id uuid,
  client_name text, client_email text, client_phone text, service_id uuid, session_mode session_mode,
  source_payment_id uuid unique references payments, purchased_sessions int, used_sessions int,
  status session_package_status, access_token_hash text, access_token text, expires_at timestamptz,
  created_by uuid, updated_at timestamptz default now());
create table site_settings (key text primary key, value jsonb);
insert into site_settings values ('home_hero', '{"image":"existing-custom-image.jpg","heading":"Custom heading"}');
