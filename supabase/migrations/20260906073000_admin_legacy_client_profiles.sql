-- Extend client profiles so admins can record legacy/offline clients.

alter table public.clients
  add column if not exists email text,
  add column if not exists surname text,
  add column if not exists other_names text,
  add column if not exists address text,
  add column if not exists wedding_anniversary_date date,
  add column if not exists occupation text,
  add column if not exists record_source text not null default 'platform';

update public.clients
set record_source = 'platform'
where record_source is null;

create unique index if not exists clients_email_lower_key
  on public.clients (lower(email))
  where email is not null;
