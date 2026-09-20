-- Batch D: services, therapists, availability, and client management foundation.

create type public.availability_exception_kind as enum ('blocked', 'added');
create type public.session_mode as enum ('online', 'in_person', 'phone');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  sessions_per_package integer not null default 1 check (sessions_per_package > 0),
  price_ngn numeric(12, 2) check (price_ngn is null or price_ngn >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.therapists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  slug text not null unique,
  full_name text not null,
  role_title text not null,
  credentials text,
  bio text,
  location text,
  specialties text[] not null default '{}',
  modalities public.session_mode[] not null default '{}',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.therapist_services (
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (therapist_id, service_id)
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  mode public.session_mode not null default 'online',
  timezone text not null default 'Africa/Lagos',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  kind public.availability_exception_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode public.session_mode,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  date_of_birth date,
  preferred_mode public.session_mode,
  assigned_therapist_id uuid references public.therapists(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index availability_rules_therapist_day_idx
  on public.availability_rules (therapist_id, day_of_week)
  where is_active;
create index availability_exceptions_therapist_time_idx
  on public.availability_exceptions (therapist_id, starts_at, ends_at);
create index clients_assigned_therapist_idx
  on public.clients (assigned_therapist_id)
  where assigned_therapist_id is not null;
create index client_notes_client_created_idx
  on public.client_notes (client_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create trigger therapists_set_updated_at
before update on public.therapists
for each row execute function public.set_updated_at();

create trigger availability_rules_set_updated_at
before update on public.availability_rules
for each row execute function public.set_updated_at();

create trigger availability_exceptions_set_updated_at
before update on public.availability_exceptions
for each row execute function public.set_updated_at();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger client_notes_set_updated_at
before update on public.client_notes
for each row execute function public.set_updated_at();

alter table public.services enable row level security;
alter table public.therapists enable row level security;
alter table public.therapist_services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;

grant select on public.services to anon, authenticated;
grant select on public.therapists to anon, authenticated;
grant select on public.therapist_services to anon, authenticated;
grant select on public.availability_rules to anon, authenticated;
grant select on public.availability_exceptions to anon, authenticated;
grant select on public.clients to authenticated;
grant select, insert, update, delete on public.client_notes to authenticated;

create policy services_public_read
on public.services for select
to anon, authenticated
using (is_active);

create policy therapists_public_read
on public.therapists for select
to anon, authenticated
using (is_active);

create policy therapist_services_public_read
on public.therapist_services for select
to anon, authenticated
using (
  exists (
    select 1
    from public.therapists therapist
    join public.services service on service.id = therapist_services.service_id
    where therapist.id = therapist_services.therapist_id
      and therapist.is_active
      and service.is_active
  )
);

create policy availability_rules_public_read
on public.availability_rules for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.therapists therapist
    where therapist.id = availability_rules.therapist_id
      and therapist.is_active
  )
);

create policy availability_exceptions_public_read
on public.availability_exceptions for select
to anon, authenticated
using (
  ends_at >= now()
  and exists (
    select 1
    from public.therapists therapist
    where therapist.id = availability_exceptions.therapist_id
      and therapist.is_active
  )
);

create policy clients_read_own_or_assigned
on public.clients for select
to authenticated
using (
  id = auth.uid()
  or public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'staff')
    and exists (
      select 1
      from public.therapists therapist
      where therapist.id = clients.assigned_therapist_id
        and therapist.user_id = auth.uid()
    )
  )
);

create policy client_notes_staff_read
on public.client_notes for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'staff')
    and exists (
      select 1
      from public.clients client
      join public.therapists therapist on therapist.id = client.assigned_therapist_id
      where client.id = client_notes.client_id
        and therapist.user_id = auth.uid()
    )
  )
);

create policy client_notes_staff_insert
on public.client_notes for insert
to authenticated
with check (
  author_id = auth.uid()
  and (
    public.has_role(auth.uid(), 'admin')
    or (
      public.has_role(auth.uid(), 'staff')
      and exists (
        select 1
        from public.clients client
        join public.therapists therapist on therapist.id = client.assigned_therapist_id
        where client.id = client_notes.client_id
          and therapist.user_id = auth.uid()
      )
    )
  )
);

create policy client_notes_staff_update
on public.client_notes for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'staff')
    and exists (
      select 1
      from public.clients client
      join public.therapists therapist on therapist.id = client.assigned_therapist_id
      where client.id = client_notes.client_id
        and therapist.user_id = auth.uid()
    )
  )
)
with check (author_id = auth.uid());

create policy client_notes_staff_delete
on public.client_notes for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'staff')
    and exists (
      select 1
      from public.clients client
      join public.therapists therapist on therapist.id = client.assigned_therapist_id
      where client.id = client_notes.client_id
        and therapist.user_id = auth.uid()
    )
  )
);

insert into public.clients (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

insert into public.services (
  code,
  slug,
  name,
  description,
  duration_minutes,
  sessions_per_package,
  price_ngn,
  display_order
)
values
  ('clarity_call', 'clarity-call', 'Clarity Call', 'A focused first conversation to choose the right next step.', 15, 1, null, 10),
  ('individual', 'individual', 'Individual Therapy', 'One-to-one support at your pace.', 60, 1, 55000, 20),
  ('couple', 'couple', 'Couple Therapy', 'Support for communication, intimacy, trust, and repair.', 90, 1, 90000, 30),
  ('organizational', 'organizational', 'Organizational Counselling', 'Mental health support for healthier teams.', 60, 1, null, 40),
  ('premarital', 'premarital', 'Premarital Counselling', 'Structured support before marriage.', 90, 1, null, 50),
  ('infidelity_recovery', 'infidelity-recovery', 'Infidelity Recovery Therapy', 'Support after betrayal and during repair.', 60, 1, null, 60),
  ('teen_child', 'teen-child', 'Teen/Child Therapy', 'Age-appropriate support for younger clients.', 60, 1, 50000, 70),
  ('family', 'family', 'Family Therapy', 'Support for families navigating change and conflict.', 90, 1, null, 80),
  ('one_month_individual', 'one-month-individual', 'One-Month Individual Plan', 'Four individual therapy sessions in one month.', 60, 4, 210000, 90),
  ('one_month_couple', 'one-month-couple', 'One-Month Couple Plan', 'Four couple therapy sessions in one month.', 90, 4, 342000, 100),
  ('psychotherapy', 'psychotherapy', 'Psychotherapy Assessment', 'In-depth assessment and treatment planning.', 90, 1, 100000, 110);

insert into public.therapists (
  slug,
  full_name,
  role_title,
  credentials,
  bio,
  location,
  specialties,
  modalities
)
values
  (
    'amara-okoro',
    'Dr. Amara Okoro',
    'Clinical Lead · Individual & couples',
    'PhD Clinical Psychology, University of Ibadan · 12 yrs',
    'Amara specialises in anxiety, trauma and relationship therapy, drawing on CBT, EMDR and emotion-focused work.',
    'Lagos · Online',
    array['Anxiety & Stress Disorders', 'Trauma & PTSD', 'Marriage & Couple Therapy'],
    array['online'::public.session_mode, 'in_person'::public.session_mode]
  ),
  (
    'emeka-nwosu',
    'Emeka Nwosu, MSc',
    'Individual therapy · Men''s mental health',
    'MSc Counselling Psychology · Chartered · 8 yrs',
    'Emeka works with men navigating burnout, grief, fatherhood and career transitions, in a warm, no-judgement style.',
    'Online (nationwide)',
    array['Individual Psychotherapy', 'Anxiety & Stress Disorders', 'Grief & Life Transitions'],
    array['online'::public.session_mode]
  ),
  (
    'ngozi-balogun',
    'Mrs. Ngozi Balogun',
    'Family & group therapist',
    'MA Family Therapy · Systemic-trained · 20 yrs',
    'Ngozi facilitates our family and group programmes, with deep expertise in blended families, teenagers and grief work.',
    'Gbagada rooms · Online',
    array['Family & Premarital Counseling', 'Teen & Child Therapy', 'Grief & Life Transitions'],
    array['online'::public.session_mode, 'in_person'::public.session_mode]
  );

insert into public.therapist_services (therapist_id, service_id)
select therapist.id, service.id
from public.therapists therapist
cross join public.services service
where therapist.slug = 'amara-okoro'
  and service.code in ('individual', 'couple', 'premarital', 'infidelity_recovery', 'psychotherapy')
on conflict do nothing;

insert into public.therapist_services (therapist_id, service_id)
select therapist.id, service.id
from public.therapists therapist
cross join public.services service
where therapist.slug = 'emeka-nwosu'
  and service.code in ('individual', 'psychotherapy')
on conflict do nothing;

insert into public.therapist_services (therapist_id, service_id)
select therapist.id, service.id
from public.therapists therapist
cross join public.services service
where therapist.slug = 'ngozi-balogun'
  and service.code in ('family', 'teen_child', 'couple', 'premarital')
on conflict do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id, role) do nothing;

  insert into public.clients (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;
