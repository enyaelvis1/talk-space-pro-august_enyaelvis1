-- Track intake completion state explicitly so admin can distinguish submitted records.
alter table public.intake_submissions
add column if not exists completion_state text not null default 'completed'
check (completion_state in ('draft', 'in_progress', 'completed'));
