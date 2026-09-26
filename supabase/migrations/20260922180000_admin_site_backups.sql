-- Protected logical backup catalog and private archive bucket.
-- Physical database snapshots remain Supabase-managed infrastructure.

create table if not exists public.site_backups (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 120),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'restoring', 'restored', 'restore_failed')),
  format_version text not null default '1',
  storage_path text unique,
  checksum_sha256 text,
  manifest jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  restored_at timestamptz
);

create index if not exists site_backups_created_idx
  on public.site_backups(created_at desc);
create index if not exists site_backups_status_idx
  on public.site_backups(status, created_at desc);

alter table public.site_backups enable row level security;

drop policy if exists site_backups_admin_read on public.site_backups;
create policy site_backups_admin_read
  on public.site_backups for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on public.site_backups from anon, authenticated;
grant select on public.site_backups to authenticated;
grant all on public.site_backups to service_role;

insert into storage.buckets (id, name, public)
values ('site-backups', 'site-backups', false)
on conflict (id) do update set public = false, name = excluded.name;

drop policy if exists site_backups_browser_read on storage.objects;
drop policy if exists site_backups_browser_write on storage.objects;
drop policy if exists site_backups_browser_delete on storage.objects;

-- Archives are written and signed by the server-side service-role client only.

create or replace function public.restore_site_content_backup(
  p_backup_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  table_payload jsonb := coalesce(p_snapshot -> 'tables', '{}'::jsonb);
  restored jsonb := '{}'::jsonb;
  actor uuid := auth.uid();
begin
  if actor is not null and not public.has_role(actor, 'admin') then
    raise exception 'admin authorization required';
  end if;

  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and actor is null then
    raise exception 'server authorization required';
  end if;

  if p_backup_id is null or p_snapshot ->> 'formatVersion' is distinct from '1' then
    raise exception 'unsupported backup format';
  end if;

  -- Restore only public-site content/configuration. Operational records,
  -- auth identities, payments, secrets, and provider connections are excluded.
  perform set_config('app.audit_reason', 'site backup content restore', true);

  delete from public.content_entry_media;
  delete from public.content_revisions;
  delete from public.content_entries;
  delete from public.faqs;
  delete from public.testimonials;
  delete from public.redirects;
  delete from public.site_settings;

  insert into public.site_settings
    select * from jsonb_populate_recordset(null::public.site_settings, coalesce(table_payload -> 'site_settings', '[]'::jsonb));
  insert into public.content_entries
    select * from jsonb_populate_recordset(null::public.content_entries, coalesce(table_payload -> 'content_entries', '[]'::jsonb));
  insert into public.content_revisions
    select * from jsonb_populate_recordset(null::public.content_revisions, coalesce(table_payload -> 'content_revisions', '[]'::jsonb));
  insert into public.content_media
    select * from jsonb_populate_recordset(null::public.content_media, coalesce(table_payload -> 'content_media', '[]'::jsonb));
  insert into public.content_entry_media
    select * from jsonb_populate_recordset(null::public.content_entry_media, coalesce(table_payload -> 'content_entry_media', '[]'::jsonb));
  insert into public.faqs
    select * from jsonb_populate_recordset(null::public.faqs, coalesce(table_payload -> 'faqs', '[]'::jsonb));
  insert into public.testimonials
    select * from jsonb_populate_recordset(null::public.testimonials, coalesce(table_payload -> 'testimonials', '[]'::jsonb));
  insert into public.redirects
    select * from jsonb_populate_recordset(null::public.redirects, coalesce(table_payload -> 'redirects', '[]'::jsonb));

  restored := jsonb_build_object(
    'backupId', p_backup_id,
    'tables', jsonb_build_object(
      'site_settings', jsonb_array_length(coalesce(table_payload -> 'site_settings', '[]'::jsonb)),
      'content_entries', jsonb_array_length(coalesce(table_payload -> 'content_entries', '[]'::jsonb)),
      'content_revisions', jsonb_array_length(coalesce(table_payload -> 'content_revisions', '[]'::jsonb)),
      'content_media', jsonb_array_length(coalesce(table_payload -> 'content_media', '[]'::jsonb)),
      'content_entry_media', jsonb_array_length(coalesce(table_payload -> 'content_entry_media', '[]'::jsonb)),
      'faqs', jsonb_array_length(coalesce(table_payload -> 'faqs', '[]'::jsonb)),
      'testimonials', jsonb_array_length(coalesce(table_payload -> 'testimonials', '[]'::jsonb)),
      'redirects', jsonb_array_length(coalesce(table_payload -> 'redirects', '[]'::jsonb))
    )
  );

  return restored;
end;
$$;

revoke all on function public.restore_site_content_backup(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.restore_site_content_backup(uuid, jsonb) to service_role;
