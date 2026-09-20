import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

const API_ROOT = "https://www.talkspace.ng/wp-json/wp/v2";
const DEFAULT_OUTPUT = "supabase/migrations/20260715120000_talkspace_content_seed.sql";
const PAGE_SIZE = 100;

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonValue(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function embedded(record, key) {
  return record._embedded?.[key]?.[0] ?? null;
}

async function fetchCollection(type) {
  const records = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(`${API_ROOT}/${type}`);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("orderby", "id");
    url.searchParams.set("order", "asc");
    url.searchParams.set("_embed", "1");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`WordPress API ${type} page ${page} failed: ${response.status}`);
    }

    const batch = await response.json();
    records.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return records;
}

function normalizeRecord(kind, record) {
  const author = embedded(record, "author");
  const media = embedded(record, "wp:featuredmedia");
  const isCategory = kind === "category";
  const title = isCategory ? record.name : record.title?.rendered;
  const excerpt = isCategory ? record.description : record.excerpt?.rendered;
  const body = isCategory ? record.description : record.content?.rendered;

  return {
    kind,
    sourceId: record.id,
    slug: record.slug,
    canonicalPath: `/content/${kind}s/${record.slug}`,
    title: title || record.slug,
    excerptHtml: excerpt || null,
    bodyHtml: body || null,
    status: record.status ?? "publish",
    publishedAt: record.date_gmt || record.date || null,
    modifiedAt: record.modified_gmt || record.modified || null,
    authorName: author?.name || null,
    featuredMediaSourceHash: media?.source_url
      ? createHash("sha256").update(media.source_url).digest("hex")
      : null,
    metadata: {
      source: "wordpress-rest-api",
      wordpress_id: record.id,
      author_id: record.author ?? null,
      featured_media_id: record.featured_media ?? null,
      category_ids: record.categories ?? [],
      tag_ids: record.tags ?? [],
      featured_media_source_hash: media?.source_url
        ? createHash("sha256").update(media.source_url).digest("hex")
        : null,
    },
  };
}

function valuesSql(record) {
  return [
    sqlString(record.kind),
    record.sourceId,
    sqlString(record.slug),
    sqlString(record.canonicalPath),
    sqlString(record.title),
    sqlString(record.excerptHtml),
    sqlString(record.bodyHtml),
    sqlString(record.status),
    sqlString(record.publishedAt),
    sqlString(record.modifiedAt),
    sqlString(record.authorName),
    "null",
    jsonValue(record.metadata),
  ].join(", ");
}

function migrationSql(records) {
  const values = records.map((record) => `  (${valuesSql(record)})`).join(",\n");

  return `-- Snapshot of the public Talk Space WordPress content imported on 15 July 2026.
-- Source: https://www.talkspace.ng/wp-json/wp/v2/
-- Content is stored as source HTML for a follow-up media rewrite; sanitize before rendering.

create type public.content_entry_kind as enum ('page', 'post', 'category');

create table public.content_entries (
  id uuid primary key default gen_random_uuid(),
  kind public.content_entry_kind not null,
  source_id bigint not null,
  slug text not null,
  canonical_path text not null,
  title text not null,
  excerpt_html text,
  body_html text,
  source_status text not null default 'publish',
  published_at timestamptz,
  source_modified_at timestamptz,
  author_name text,
  featured_media_path text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, source_id),
  unique (kind, slug)
);

create index content_entries_kind_status_idx
  on public.content_entries (kind, source_status, published_at desc);

create index content_entries_slug_idx
  on public.content_entries (slug);

alter table public.content_entries enable row level security;

grant select on public.content_entries to anon, authenticated;
grant insert, update, delete on public.content_entries to authenticated;

create policy content_entries_public_read
on public.content_entries for select
to anon, authenticated
using (source_status = 'publish');

create policy content_entries_admin_write
on public.content_entries for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create trigger content_entries_set_updated_at
before update on public.content_entries
for each row execute function public.set_updated_at();

insert into public.content_entries (
  kind,
  source_id,
  slug,
  canonical_path,
  title,
  excerpt_html,
  body_html,
  source_status,
  published_at,
  source_modified_at,
  author_name,
  featured_media_path,
  metadata
)
values
${values}
on conflict (kind, source_id) do update set
  slug = excluded.slug,
  canonical_path = excluded.canonical_path,
  title = excluded.title,
  excerpt_html = excluded.excerpt_html,
  body_html = excluded.body_html,
  source_status = excluded.source_status,
  published_at = excluded.published_at,
  source_modified_at = excluded.source_modified_at,
  author_name = excluded.author_name,
  featured_media_path = excluded.featured_media_path,
  metadata = excluded.metadata,
  updated_at = now();
`;
}

const output = resolve(process.cwd(), process.argv[2] || DEFAULT_OUTPUT);
const [pages, posts, categories] = await Promise.all([
  fetchCollection("pages"),
  fetchCollection("posts"),
  fetchCollection("categories"),
]);

const records = [
  ...pages.map((record) => normalizeRecord("page", record)),
  ...posts.map((record) => normalizeRecord("post", record)),
  ...categories.map((record) => normalizeRecord("category", record)),
];

await mkdir(dirname(output), { recursive: true });
await writeFile(output, migrationSql(records), "utf8");

console.log(`Wrote ${records.length} content records to ${output}`);
console.log(`Pages: ${pages.length}; posts: ${posts.length}; categories: ${categories.length}`);
