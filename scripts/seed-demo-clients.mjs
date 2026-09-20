import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.DEMO_CLIENT_PASSWORD ?? "TalkSpaceDemo!2026";

if (!supabaseUrl || !adminKey) {
  throw new Error(
    "Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY, plus SUPABASE_URL or VITE_SUPABASE_URL before seeding.",
  );
}

if (adminKey.startsWith("sb_publishable_") || adminKey.startsWith("sb_anon_")) {
  throw new Error(
    "The configured Supabase key is public. Use the server-only sb_secret_... key as SUPABASE_SECRET_KEY, never the VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const demoClients = [
  {
    email: "demo.client.1@talkspace.test",
    fullName: "Amina Yusuf",
    phone: "+234 800 000 0001",
    dateOfBirth: "1992-04-18",
    preferredMode: "online",
    therapistSlug: "amara-okoro",
  },
  {
    email: "demo.client.2@talkspace.test",
    fullName: "Chinedu Okafor",
    phone: "+234 800 000 0002",
    dateOfBirth: "1988-09-06",
    preferredMode: "in_person",
    therapistSlug: "ngozi-balogun",
  },
  {
    email: "demo.client.3@talkspace.test",
    fullName: "Tolu Adeyemi",
    phone: "+234 800 000 0003",
    dateOfBirth: "1997-01-24",
    preferredMode: "phone",
    therapistSlug: "emeka-nwosu",
  },
  {
    email: "demo.client.4@talkspace.test",
    fullName: "Ifeoma Eze",
    phone: "+234 800 000 0004",
    dateOfBirth: "1990-11-12",
    preferredMode: "online",
    therapistSlug: "amara-okoro",
  },
  {
    email: "demo.client.5@talkspace.test",
    fullName: "Daniel Balogun",
    phone: "+234 800 000 0005",
    dateOfBirth: "1985-07-30",
    preferredMode: "in_person",
    therapistSlug: "ngozi-balogun",
  },
];

async function listUsersByEmail() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    if (error.status === 401 || error.status === 403 || error.code === "not_admin") {
      throw new Error(
        "Supabase rejected the admin key. Use the project's server-only sb_secret_... key as SUPABASE_SECRET_KEY, or the legacy service_role key as SUPABASE_SERVICE_ROLE_KEY; public publishable/anon keys are not allowed.",
      );
    }
    throw error;
  }
  return new Map(data.users.map((user) => [user.email?.toLowerCase(), user]));
}

async function getTherapistIds() {
  const slugs = [...new Set(demoClients.map((client) => client.therapistSlug))];
  const { data, error } = await supabase.from("therapists").select("id, slug").in("slug", slugs);
  if (error) throw error;
  return new Map((data ?? []).map((therapist) => [therapist.slug, therapist.id]));
}

const usersByEmail = await listUsersByEmail();
const therapistIds = await getTherapistIds();

for (const demoClient of demoClients) {
  let user = usersByEmail.get(demoClient.email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: demoClient.email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        full_name: demoClient.fullName,
        seeded_demo_client: true,
      },
    });
    if (error) throw error;
    user = data.user;
  }

  if (!user) throw new Error(`Unable to create or find ${demoClient.email}`);

  const { error } = await supabase.from("clients").upsert(
    {
      id: user.id,
      full_name: demoClient.fullName,
      phone: demoClient.phone,
      date_of_birth: demoClient.dateOfBirth,
      preferred_mode: demoClient.preferredMode,
      assigned_therapist_id: therapistIds.get(demoClient.therapistSlug) ?? null,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
  console.log(`Seeded ${demoClient.fullName} (${demoClient.email})`);
}

console.log(`Done. ${demoClients.length} demo clients are ready.`);
