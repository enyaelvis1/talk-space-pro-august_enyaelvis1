import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !adminKey) {
  throw new Error(
    "Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY, plus SUPABASE_URL or VITE_SUPABASE_URL before undoing seeded demo content.",
  );
}

const supabase = createClient(supabaseUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const seededContentSourceIds = [
  990001, 990002, 990011, 990012, 990013, 990014, 990015, 990016, 990017, 990018, 990019,
];
const seededMediaSourceHashes = [
  "demo-media-hero-1",
  "demo-media-hero-2",
  "demo-media-carousel-1",
  "demo-media-carousel-2",
  "demo-media-carousel-3",
  "demo-media-avatar-1",
  "demo-media-avatar-2",
  "demo-media-avatar-3",
];
const seededTestimonialIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];

async function deleteRows(table, column, values) {
  if (values.length === 0) return;
  const { error } = await supabase.from(table).delete().in(column, values);
  if (error) throw error;
}

async function run() {
  const { data: entries, error: entryError } = await supabase
    .from("content_entries")
    .select("id")
    .in("source_id", seededContentSourceIds);

  if (entryError) throw entryError;

  const entryIds = entries?.map((entry) => entry.id).filter(Boolean) ?? [];

  if (entryIds.length > 0) {
    await deleteRows("content_entry_media", "content_entry_id", entryIds);
    console.log(`Removed ${entryIds.length} seeded content entry media links.`);
  }

  await deleteRows("content_entries", "source_id", seededContentSourceIds);
  console.log("Removed seeded content entries.");

  await deleteRows("content_media", "source_hash", seededMediaSourceHashes);
  console.log("Removed seeded media assets.");

  await deleteRows("testimonials", "id", seededTestimonialIds);
  console.log("Removed seeded testimonials.");

  console.log(
    "Done. Seeded content, media, and testimonials have been removed. Site settings seeded by the demo pack are not automatically rolled back.",
  );
}

await run();
