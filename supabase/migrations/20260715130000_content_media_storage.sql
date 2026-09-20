-- Store imported content media in this Supabase project instead of the source site.

alter table public.content_entries
  rename column source_url to canonical_path;

alter table public.content_entries
  rename column featured_media_url to featured_media_path;

update public.content_entries
set canonical_path = case kind
  when 'page' then '/content/pages/' || slug
  when 'post' then '/content/posts/' || slug
  when 'category' then '/content/categories/' || slug
end,
featured_media_path = null,
metadata = metadata - 'source_api';

create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null unique,
  storage_path text not null unique,
  source_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_entry_media (
  content_entry_id uuid not null references public.content_entries(id) on delete cascade,
  media_id uuid not null references public.content_media(id) on delete cascade,
  role text not null check (role in ('body', 'excerpt', 'featured')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (content_entry_id, media_id, role)
);

create index content_media_sha256_idx on public.content_media (sha256);
create index content_entry_media_media_idx on public.content_entry_media (media_id);

create trigger content_media_set_updated_at
before update on public.content_media
for each row execute function public.set_updated_at();

alter table public.content_media enable row level security;
alter table public.content_entry_media enable row level security;

grant select on public.content_media to anon, authenticated;
grant select on public.content_entry_media to anon, authenticated;
grant insert, update, delete on public.content_media to authenticated;
grant insert, update, delete on public.content_entry_media to authenticated;

create policy content_media_public_read
on public.content_media for select
to anon, authenticated
using (true);

create policy content_media_admin_write
on public.content_media for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy content_entry_media_public_read
on public.content_entry_media for select
to anon, authenticated
using (true);

create policy content_entry_media_admin_write
on public.content_entry_media for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do update set public = true;

create policy content_media_objects_public_read
on storage.objects for select
to public
using (bucket_id = 'content-media');

create policy content_media_objects_admin_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'content-media'
  and public.has_role(auth.uid(), 'admin')
);

create policy content_media_objects_admin_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'content-media'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'content-media'
  and public.has_role(auth.uid(), 'admin')
);

create policy content_media_objects_admin_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'content-media'
  and public.has_role(auth.uid(), 'admin')
);
