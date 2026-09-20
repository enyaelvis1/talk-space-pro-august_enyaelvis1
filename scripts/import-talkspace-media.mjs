import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const API_ROOT = "https://www.talkspace.ng/wp-json/wp/v2";
const SOURCE_HOSTS = new Set(["www.talkspace.ng", "talkspace.ng"]);
const STORAGE_BUCKET = "content-media";
const PAGE_SIZE = 100;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MEDIA_TIMEOUT_MS = Number(process.env.MEDIA_TIMEOUT_MS || 60_000);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. " +
      "Load them from a local .env file with `node --env-file=.env ...`.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicStoragePrefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeUrl(value) {
  return value.replaceAll("\\/", "/").replace(/[),.;]+$/g, "");
}

function sourceUrlVariants(value) {
  return [value, value.replaceAll("/", "\\/")];
}

function sqlSafePath(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function sourceFilename(value) {
  const pathname = new URL(value).pathname;
  const filename = decodeURIComponent(pathname.split("/").pop() || "asset");
  return sqlSafePath(filename).slice(0, 180);
}

function canonicalPath(kind, slug) {
  return `/content/${kind}s/${slug}`;
}

function pathKey(value) {
  const parsed = new URL(value);
  const pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "") + "/";
  return `${pathname}${parsed.search}${parsed.hash}`;
}

function isSourceUrl(value) {
  const hostname = new URL(value).hostname;
  return SOURCE_HOSTS.has(hostname) || hostname.endsWith(".talkspace.ng");
}

function isImageUrl(value) {
  const parsed = new URL(value);
  if (parsed.hostname === supabaseHost) return false;
  const pathname = parsed.pathname.toLowerCase();
  return (
    pathname.includes("/wp-content/uploads/") ||
    parsed.hostname.endsWith("googleusercontent.com") ||
    /\.(avif|gif|ico|jpe?g|png|svg|webp)$/i.test(pathname)
  );
}

function extractUrls(value) {
  if (!value) return [];

  const matches = value.match(/https?:\\?\/\\?\/[^"'<>\s]+/g) || [];
  return [...new Set(matches.map(normalizeUrl))];
}

function replaceUrl(html, sourceUrl, targetUrl) {
  if (!html) return html;
  let result = html;
  for (const variant of sourceUrlVariants(sourceUrl)) {
    result = result.replaceAll(variant, targetUrl);
  }
  return result;
}

function storagePathFromUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== supabaseHost || !parsed.pathname.includes(publicStoragePrefix))
      return null;
    return decodeURIComponent(parsed.pathname.split(publicStoragePrefix)[1]);
  } catch {
    return null;
  }
}

function publicStorageUrl(storagePath) {
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function storagePathsInHtml(html) {
  return [...new Set(extractUrls(html).map(storagePathFromUrl).filter(Boolean))];
}

function rewriteBareSourceLinks(html) {
  if (!html) return html;
  return html.replace(/(?:https?:\/\/)?(?:www\.|wwww\.)?talkspace\.ng(?=\/|["'\s<])/gi, "");
}

function sanitizeMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata).filter((item) => item !== null);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "source_api")
        .map(([key, item]) => [key, sanitizeMetadata(item)])
        .filter(([, item]) => item !== null),
    );
  }

  if (typeof value === "string" && [...SOURCE_HOSTS].some((host) => value.includes(host)))
    return null;
  return value;
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

async function buildSourceMaps() {
  const [pages, posts, categories] = await Promise.all([
    fetchCollection("pages"),
    fetchCollection("posts"),
    fetchCollection("categories"),
  ]);
  const links = new Map();
  const featuredMedia = new Map();

  for (const [kind, records] of [
    ["page", pages],
    ["post", posts],
    ["category", categories],
  ]) {
    for (const record of records) {
      if (record.link) links.set(pathKey(record.link), canonicalPath(kind, record.slug));

      const media = record._embedded?.["wp:featuredmedia"]?.[0];
      if (media?.source_url) {
        featuredMedia.set(`${kind}:${record.id}`, media.source_url);
      }
    }
  }

  return { links, featuredMedia };
}

async function ensureMedia(sourceUrl, altText) {
  const sourceHash = hash(sourceUrl);
  if (mediaCache.has(sourceHash)) return mediaCache.get(sourceHash);

  const { data: existing, error: lookupError } = await supabase
    .from("content_media")
    .select("id, storage_path")
    .eq("source_hash", sourceHash)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const media = { ...existing, sourceUrl };
    mediaCache.set(sourceHash, media);
    return media;
  }

  let response;
  try {
    response = await fetch(sourceUrl, { signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS) });
  } catch (error) {
    console.warn(`Skipping media that could not be downloaded: ${sourceUrl} (${error.message})`);
    mediaCache.set(sourceHash, null);
    return null;
  }
  if (!response.ok) {
    console.warn(`Skipping unavailable media (${response.status}): ${sourceUrl}`);
    mediaCache.set(sourceHash, null);
    return null;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    console.warn(`Skipping media larger than 25 MB: ${sourceUrl}`);
    mediaCache.set(sourceHash, null);
    return null;
  }

  let buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn(`Skipping media body that timed out or failed: ${sourceUrl} (${error.message})`);
    mediaCache.set(sourceHash, null);
    return null;
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    console.warn(`Skipping media larger than 25 MB: ${sourceUrl}`);
    mediaCache.set(sourceHash, null);
    return null;
  }

  const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
  const storagePath = `${sourceHash.slice(0, 16)}-${sourceFilename(sourceUrl)}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: "31536000",
      contentType: mimeType,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data: inserted, error: insertError } = await supabase
    .from("content_media")
    .insert({
      source_hash: sourceHash,
      storage_path: storagePath,
      source_filename: sourceFilename(sourceUrl),
      mime_type: mimeType,
      byte_size: buffer.byteLength,
      sha256: hash(buffer),
      alt_text: altText || null,
      metadata: { imported_from: "talkspace-content-snapshot" },
    })
    .select("id, storage_path")
    .single();
  if (insertError) throw insertError;

  const media = { ...inserted, sourceUrl };
  mediaCache.set(sourceHash, media);
  return media;
}

const mediaCache = new Map();
const { links: sourceLinks, featuredMedia: sourceFeaturedMedia } = await buildSourceMaps();

const { data: entries, error: entriesError } = await supabase
  .from("content_entries")
  .select("id, kind, source_id, slug, body_html, excerpt_html, featured_media_path, metadata")
  .order("kind")
  .order("source_id");
if (entriesError) throw entriesError;

let importedMedia = 0;
let rewrittenEntries = 0;
const rewrittenContent = [];

for (const [index, entry] of entries.entries()) {
  const featuredSource = entry.featured_media_path?.startsWith("http")
    ? entry.featured_media_path
    : sourceFeaturedMedia.get(`${entry.kind}:${entry.source_id}`) || null;
  const fields = [entry.body_html, entry.excerpt_html, featuredSource].filter(Boolean);
  const imageUrls = [...new Set(fields.flatMap(extractUrls).filter(isImageUrl))];
  const replacements = new Map();
  const mediaByUrl = new Map();

  const mediaResults = await Promise.all(
    imageUrls.map(async (imageUrl) => [imageUrl, await ensureMedia(imageUrl, null)]),
  );
  for (const [imageUrl, media] of mediaResults) {
    if (!media) {
      replacements.set(imageUrl, "");
      continue;
    }
    mediaByUrl.set(imageUrl, media);
    replacements.set(imageUrl, publicStorageUrl(media.storage_path));
    importedMedia += 1;
  }

  const rewriteHtml = (html) => {
    let result = html;
    for (const [sourceUrl, targetUrl] of replacements) {
      result = replaceUrl(result, sourceUrl, targetUrl);
    }
    for (const sourceUrl of extractUrls(result)) {
      if (!isSourceUrl(sourceUrl)) continue;
      const targetUrl = sourceLinks.get(pathKey(sourceUrl)) || new URL(sourceUrl).pathname;
      result = replaceUrl(result, sourceUrl, targetUrl);
    }
    return rewriteBareSourceLinks(result);
  };

  const bodyHtml = rewriteHtml(entry.body_html);
  const excerptHtml = rewriteHtml(entry.excerpt_html);
  const featuredMedia = featuredSource ? mediaByUrl.get(normalizeUrl(featuredSource)) : null;
  const metadata = {
    ...sanitizeMetadata(entry.metadata || {}),
    media_imported: true,
  };

  const { error: updateError } = await supabase
    .from("content_entries")
    .update({
      body_html: bodyHtml,
      excerpt_html: excerptHtml,
      featured_media_path: featuredMedia?.storage_path || null,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entry.id);
  if (updateError) throw updateError;
  rewrittenEntries += 1;
  rewrittenContent.push({
    id: entry.id,
    bodyHtml,
    excerptHtml,
    featuredMediaPath: featuredMedia?.storage_path || null,
  });

  console.log(`Processed ${index + 1}/${entries.length}: ${entry.kind}/${entry.slug}`);
}

const { data: mediaRows, error: mediaRowsError } = await supabase
  .from("content_media")
  .select("id, storage_path, mime_type")
  .limit(10000);
if (mediaRowsError) throw mediaRowsError;

const invalidMedia = mediaRows.filter(
  (media) => !media.mime_type.startsWith("image/") && media.mime_type !== "application/pdf",
);
for (const content of rewrittenContent) {
  let bodyHtml = content.bodyHtml;
  let excerptHtml = content.excerptHtml;
  for (const media of invalidMedia) {
    const sourceUrl = publicStorageUrl(media.storage_path);
    bodyHtml = replaceUrl(bodyHtml, sourceUrl, "");
    excerptHtml = replaceUrl(excerptHtml, sourceUrl, "");
  }
  if (bodyHtml !== content.bodyHtml || excerptHtml !== content.excerptHtml) {
    const { error: cleanError } = await supabase
      .from("content_entries")
      .update({
        body_html: bodyHtml,
        excerpt_html: excerptHtml,
        updated_at: new Date().toISOString(),
      })
      .eq("id", content.id);
    if (cleanError) throw cleanError;
    content.bodyHtml = bodyHtml;
    content.excerptHtml = excerptHtml;
  }
}

const validMediaRows = mediaRows.filter((media) => !invalidMedia.includes(media));
const mediaByPath = new Map(validMediaRows.map((media) => [media.storage_path, media]));
const rebuiltLinks = [];
for (const content of rewrittenContent) {
  const roles = [
    ["body", content.bodyHtml],
    ["excerpt", content.excerptHtml],
  ];
  for (const [role, html] of roles) {
    for (const [sortOrder, storagePath] of storagePathsInHtml(html).entries()) {
      const media = mediaByPath.get(storagePath);
      if (media)
        rebuiltLinks.push({
          content_entry_id: content.id,
          media_id: media.id,
          role,
          sort_order: sortOrder,
        });
    }
  }
  if (content.featuredMediaPath) {
    const media = mediaByPath.get(content.featuredMediaPath);
    if (media)
      rebuiltLinks.push({
        content_entry_id: content.id,
        media_id: media.id,
        role: "featured",
        sort_order: 0,
      });
  }
}

const { error: clearLinksError } = await supabase
  .from("content_entry_media")
  .delete()
  .not("content_entry_id", "is", null);
if (clearLinksError) throw clearLinksError;

for (let offset = 0; offset < rebuiltLinks.length; offset += 500) {
  const { error: linkError } = await supabase
    .from("content_entry_media")
    .insert(rebuiltLinks.slice(offset, offset + 500));
  if (linkError) throw linkError;
}

const linkedMediaIds = new Set(rebuiltLinks.map((link) => link.media_id));
const orphanMedia = mediaRows.filter((media) => !linkedMediaIds.has(media.id));
for (let offset = 0; offset < orphanMedia.length; offset += 100) {
  const batch = orphanMedia.slice(offset, offset + 100);
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(batch.map((media) => media.storage_path));
  if (storageError) throw storageError;

  const { error: deleteError } = await supabase
    .from("content_media")
    .delete()
    .in(
      "id",
      batch.map((media) => media.id),
    );
  if (deleteError) throw deleteError;
}

console.log(`Rewritten entries: ${rewrittenEntries}`);
console.log(`Media references processed: ${importedMedia}`);
console.log(`Content/media links rebuilt: ${rebuiltLinks.length}`);
console.log(`Orphan media removed: ${orphanMedia.length}`);
console.log(`Unique media records available: ${[...mediaCache.values()].filter(Boolean).length}`);
