-- Persist the explicit template version for secure intake submissions.
alter table public.intake_submissions
add column if not exists template_version integer;

update public.intake_submissions
set template_version = case
  when template_key ~ '_v[0-9]+$' then regexp_replace(template_key, '^.*_v([0-9]+)$', '\1')::integer
  else 1
end
where template_version is null;

alter table public.intake_submissions
alter column template_version set default 1;

update public.intake_submissions
set template_version = 1
where template_version is null;

alter table public.intake_submissions
alter column template_version set not null;

alter table public.intake_submissions
add constraint intake_submissions_template_version_positive check (template_version > 0);
