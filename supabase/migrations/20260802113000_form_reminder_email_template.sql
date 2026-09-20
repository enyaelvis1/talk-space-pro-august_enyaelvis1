-- Dedicated intake-form reminder template and delivery state.
insert into public.email_template_settings (template_key, display_name, description)
values (
  'form_reminder',
  'Form completion reminder',
  'Sent by an administrator when a client has an unfinished booking or contact form.'
)
on conflict (template_key) do nothing;

alter table public.intake_submissions
add column if not exists reminder_sent_at timestamptz,
add column if not exists reminder_sent_by uuid references auth.users(id) on delete set null;

create index if not exists intake_submissions_pending_reminder_idx
on public.intake_submissions (updated_at desc)
where completion_state in ('draft', 'in_progress');
