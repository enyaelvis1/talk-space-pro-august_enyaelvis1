-- Secure intake snapshot storage for booking, contact, and future assessment forms.
create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('booking', 'contact', 'assessment')),
  template_key text not null,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  contact_submission_id uuid references public.contact_submissions(id) on delete cascade,
  subject_name text,
  subject_email text,
  payload jsonb not null,
  consent_acknowledged_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subject_email is null or length(trim(subject_email)) between 3 and 255)
);

create index intake_submissions_client_created_idx on public.intake_submissions (client_id, created_at desc);
create index intake_submissions_appointment_idx on public.intake_submissions (appointment_id);
create index intake_submissions_contact_submission_idx on public.intake_submissions (contact_submission_id);
create index intake_submissions_template_key_idx on public.intake_submissions (template_key);

create trigger intake_submissions_set_updated_at
before update on public.intake_submissions
for each row execute function public.set_updated_at();

alter table public.intake_submissions enable row level security;
grant select on public.intake_submissions to authenticated;
grant all on public.intake_submissions to service_role;

create policy intake_submissions_admin_read on public.intake_submissions
for select to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy intake_submissions_client_read_own on public.intake_submissions
for select to authenticated
using (
  client_id = auth.uid()
  or exists (
    select 1
    from public.appointments appointment
    where appointment.id = intake_submissions.appointment_id
      and appointment.client_id = auth.uid()
  )
);
