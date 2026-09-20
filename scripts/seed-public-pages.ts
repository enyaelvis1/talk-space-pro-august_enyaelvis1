/**
 * Seed the editable section content for every public page.
 *
 * Run with: `bun run scripts/seed-public-pages.ts [--force]`
 *
 * By default a page that already has sections is left alone; `--force`
 * overwrites it with the defaults in `src/lib/page-seed-content.ts`.
 */

import { createClient } from "@supabase/supabase-js";

import { PUBLIC_PAGE_SEED } from "../src/lib/page-seed-content";
import { PUBLIC_PAGE_CONFIG } from "../src/lib/public-pages";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !serviceKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const force = process.argv.includes("--force");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

for (const page of PUBLIC_PAGE_CONFIG) {
  const seed = PUBLIC_PAGE_SEED[page.key];
  if (!seed) {
    console.log(`- ${page.key}: no seed defined, skipped`);
    continue;
  }

  const { data: existing, error: readError } = await admin
    .from("content_entries")
    .select("id, metadata, source_status")
    .eq("kind", "page")
    .eq("slug", page.contentSlug)
    .maybeSingle();
  if (readError) throw readError;

  const metadata = (existing?.metadata as Record<string, unknown> | null) ?? {};
  const hasSections = Array.isArray(metadata["sections"]) && metadata["sections"].length > 0;
  if (hasSections && !force) {
    console.log(`- ${page.key}: already has sections, skipped (use --force to overwrite)`);
    continue;
  }

  const nextMetadata = { ...metadata, sections: seed.sections };
  delete nextMetadata["sectionsDraft"];
  const now = new Date().toISOString();

  if (existing) {
    const { error } = await admin
      .from("content_entries")
      .update({
        title: seed.title,
        canonical_path: page.route,
        excerpt_html: seed.excerptHtml,
        metadata: nextMetadata,
        source_status: "publish",
        published_at: now,
        archived_at: null,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw error;
    console.log(`- ${page.key}: updated (${seed.sections.length} sections)`);
  } else {
    const { error } = await admin.from("content_entries").insert({
      kind: "page",
      source_id: Date.now(),
      slug: page.contentSlug,
      canonical_path: page.route,
      title: seed.title,
      excerpt_html: seed.excerptHtml,
      metadata: nextMetadata,
      source_status: "publish",
      published_at: now,
      imported_at: now,
      source_modified_at: now,
    });
    if (error) throw error;
    console.log(`- ${page.key}: created (${seed.sections.length} sections)`);
  }
}

console.log("Done.");
