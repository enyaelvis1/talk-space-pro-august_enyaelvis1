
-- Google Calendar / Meet integration schema
create table public.google_oauth_settings (
  id smallint primary key default 1 check (id = 1),
  is_enabled boolean not null default false,
  client_id text,
  client_secret_ciphertext text,
  redirect_path text not null default '/api/public/google/callback',
  scopes text not null default 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.google_oauth_settings to authenticated;
grant all on public.google_oauth_settings to service_role;
alter table public.google_oauth_settings enable row level security;
create policy google_oauth_settings_admin on public.google_oauth_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger google_oauth_settings_set_updated_at before update on public.google_oauth_settings
  for each row execute function public.set_updated_at();
insert into public.google_oauth_settings (id) values (1) on conflict (id) do nothing;

create table public.therapist_google_connections (
  therapist_id uuid primary key references public.therapists(id) on delete cascade,
  google_email text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  calendar_id text not null default 'primary',
  last_sync_at timestamptz,
  last_sync_error text,
  sync_channel_id text,
  sync_resource_id text,
  sync_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.therapist_google_connections to authenticated;
grant all on public.therapist_google_connections to service_role;
alter table public.therapist_google_connections enable row level security;
create policy tgc_admin_all on public.therapist_google_connections for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy tgc_staff_read on public.therapist_google_connections for select to authenticated
  using (public.has_role(auth.uid(), 'staff'));
create trigger tgc_set_updated_at before update on public.therapist_google_connections
  for each row execute function public.set_updated_at();

alter table public.appointments
  add column if not exists google_event_id text,
  add column if not exists google_meet_url text,
  add column if not exists google_sync_error text,
  add column if not exists google_synced_at timestamptz;

alter table public.availability_exceptions
  add column if not exists source text not null default 'manual',
  add column if not exists external_ref text;
create index if not exists availability_exceptions_source_idx
  on public.availability_exceptions (therapist_id, source);
