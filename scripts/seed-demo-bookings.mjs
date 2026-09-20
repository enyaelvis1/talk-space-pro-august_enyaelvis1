import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !adminKey) {
  throw new Error(
    "Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY, plus SUPABASE_URL or VITE_SUPABASE_URL before seeding demo bookings.",
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
  { email: "demo.client.1@talkspace.test", fullName: "Amina Yusuf", phone: "+234 800 000 0001" },
  { email: "demo.client.2@talkspace.test", fullName: "Chinedu Okafor", phone: "+234 800 000 0002" },
  { email: "demo.client.3@talkspace.test", fullName: "Tolu Adeyemi", phone: "+234 800 000 0003" },
  { email: "demo.client.4@talkspace.test", fullName: "Ifeoma Eze", phone: "+234 800 000 0004" },
  { email: "demo.client.5@talkspace.test", fullName: "Daniel Balogun", phone: "+234 800 000 0005" },
];

const demoBookings = [
  {
    bookingReference: "TS-DEMO-BOOK-1001",
    clientEmail: "demo.client.1@talkspace.test",
    therapistSlug: "amara-okoro",
    serviceCode: "individual",
    sessionMode: "online",
    startsInDays: 2,
    startsAtHour: 9,
    startsAtMinute: 0,
    status: "hold",
    manageToken: "demo-manage-token-1001",
    notes: "Seeded hold for admin booking and calendar testing.",
  },
  {
    bookingReference: "TS-DEMO-BOOK-1002",
    clientEmail: "demo.client.2@talkspace.test",
    therapistSlug: "ngozi-balogun",
    serviceCode: "couple",
    sessionMode: "in_person",
    startsInDays: 3,
    startsAtHour: 11,
    startsAtMinute: 0,
    status: "pending_payment",
    paymentKind: "paystack",
    paymentReference: "TS-DEMO-PAY-1002",
    providerReference: "demo-paystack-ref-1002",
    manageToken: "demo-manage-token-1002",
    notes: "Seeded Paystack payment flow in progress.",
  },
  {
    bookingReference: "TS-DEMO-BOOK-1003",
    clientEmail: "demo.client.3@talkspace.test",
    therapistSlug: "emeka-nwosu",
    serviceCode: "individual",
    sessionMode: "online",
    startsInDays: 4,
    startsAtHour: 14,
    startsAtMinute: 0,
    status: "pending_payment",
    paymentKind: "bank_transfer",
    paymentReference: "TS-DEMO-BANK-1003",
    manageToken: "demo-manage-token-1003",
    notes: "Seeded bank-transfer review flow.",
    receiptPath: "demo-receipts/ts-demo-book-1003.pdf",
  },
  {
    bookingReference: "TS-DEMO-BOOK-1004",
    clientEmail: "demo.client.4@talkspace.test",
    therapistSlug: "amara-okoro",
    serviceCode: "individual",
    sessionMode: "online",
    startsInDays: 5,
    startsAtHour: 10,
    startsAtMinute: 0,
    status: "confirmed",
    paymentKind: "paystack",
    paymentReference: "TS-DEMO-PAY-1004",
    providerReference: "demo-paystack-ref-1004",
    manageToken: "demo-manage-token-1004",
    notes: "Seeded confirmed appointment for admin dashboard testing.",
  },
  {
    bookingReference: "TS-DEMO-BOOK-1005",
    clientEmail: "demo.client.5@talkspace.test",
    therapistSlug: "emeka-nwosu",
    serviceCode: "psychotherapy",
    sessionMode: "online",
    startsInDays: -2,
    startsAtHour: 13,
    startsAtMinute: 0,
    status: "completed",
    paymentKind: "paystack",
    paymentReference: "TS-DEMO-PAY-1005",
    providerReference: "demo-paystack-ref-1005",
    manageToken: "demo-manage-token-1005",
    notes: "Seeded completed appointment for reporting/timeline testing.",
  },
  {
    bookingReference: "TS-DEMO-BOOK-1006",
    clientEmail: "demo.client.1@talkspace.test",
    therapistSlug: "ngozi-balogun",
    serviceCode: "couple",
    sessionMode: "in_person",
    startsInDays: -1,
    startsAtHour: 15,
    startsAtMinute: 0,
    status: "cancelled",
    manageToken: "demo-manage-token-1006",
    notes: "Seeded cancelled appointment for empty-state and history testing.",
  },
];

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function findMapValue(map, key, description) {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Missing ${description} for ${key}. Run the demo client seed first.`);
  }
  return value;
}

function getLagosDateParts(reference = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(reference);
  const entries = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return {
    year: entries.year,
    month: entries.month,
    day: entries.day,
  };
}

function buildLagosDateTime({ daysFromNow, hour, minute }) {
  const { year, month, day } = getLagosDateParts();
  const base = new Date(`${year}-${month}-${day}T00:00:00+01:00`);
  base.setUTCDate(base.getUTCDate() + daysFromNow);

  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}:00+01:00`;
}

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

async function getLookupMaps() {
  const [{ data: therapists, error: therapistError }, { data: services, error: serviceError }] =
    await Promise.all([
      supabase.from("therapists").select("id, slug"),
      supabase.from("services").select("id, code, duration_minutes, price_ngn"),
    ]);

  if (therapistError) throw therapistError;
  if (serviceError) throw serviceError;

  return {
    therapistIds: new Map((therapists ?? []).map((therapist) => [therapist.slug, therapist.id])),
    serviceByCode: new Map((services ?? []).map((service) => [service.code, service])),
  };
}

async function upsertAppointment(booking, clientId, therapistId, service) {
  const startsAt = buildLagosDateTime({
    daysFromNow: booking.startsInDays,
    hour: booking.startsAtHour,
    minute: booking.startsAtMinute,
  });
  const endsAt = new Date(
    new Date(startsAt).getTime() + service.duration_minutes * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("appointments").upsert(
    {
      booking_reference: booking.bookingReference,
      client_id: clientId,
      client_name: booking.clientName,
      client_email: booking.clientEmail,
      client_phone: booking.clientPhone,
      therapist_id: therapistId,
      service_id: service.id,
      session_mode: booking.sessionMode,
      starts_at: startsAt,
      ends_at: endsAt,
      status: booking.status,
      hold_expires_at:
        booking.status === "hold" ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
      manage_token_hash: hashToken(booking.manageToken),
      manage_token: booking.manageToken,
      notes: booking.notes,
      paid_amount_kobo: booking.status === "completed" ? (booking.paidAmountKobo ?? null) : null,
      payment_reference: booking.status === "completed" ? (booking.paymentReference ?? null) : null,
    },
    { onConflict: "booking_reference" },
  );

  if (error) throw error;
}

async function seedPaymentFlow(booking, appointmentId, amountKobo) {
  if (booking.paymentKind === "paystack") {
    const { error: initError } = await supabase.rpc("record_payment_initiated", {
      p_appointment_id: appointmentId,
      p_provider: "paystack",
      p_reference: booking.paymentReference,
      p_amount_kobo: amountKobo,
      p_authorization_url: `https://paystack.local/demo/${booking.paymentReference}`,
      p_metadata: {
        seeded_demo: true,
        seeded_by: "seed-demo-bookings",
        booking_reference: booking.bookingReference,
      },
    });
    if (initError) throw initError;

    if (booking.status === "confirmed" || booking.status === "completed") {
      const { error: confirmError } = await supabase.rpc("mark_payment_status", {
        p_reference: booking.paymentReference,
        p_new_status: "succeeded",
        p_provider_reference: booking.providerReference,
        p_metadata: {
          seeded_demo: true,
          seeded_by: "seed-demo-bookings",
          booking_reference: booking.bookingReference,
        },
      });
      if (confirmError) throw confirmError;

      if (booking.status === "completed") {
        const { error: completeError } = await supabase
          .from("appointments")
          .update({ status: "completed" })
          .eq("booking_reference", booking.bookingReference);
        if (completeError) throw completeError;
      }
    }
    return;
  }

  if (booking.paymentKind === "bank_transfer") {
    const { error } = await supabase.rpc("submit_bank_transfer", {
      p_appointment_id: appointmentId,
      p_reference: booking.paymentReference,
      p_amount_kobo: amountKobo,
      p_transfer_note: "Seeded demo bank transfer for review workflows.",
      p_receipt_path: booking.receiptPath,
      p_manage_token_hash: hashToken(booking.manageToken),
    });
    if (error) throw error;
  }
}

const usersByEmail = await listUsersByEmail();
const { therapistIds, serviceByCode } = await getLookupMaps();

const missingClients = demoClients.filter((client) => !usersByEmail.has(client.email));
if (missingClients.length > 0) {
  throw new Error(
    `Missing demo client users: ${missingClients.map((client) => client.email).join(", ")}. Run npm run db:seed:clients first, or use npm run db:seed:demo.`,
  );
}

for (const booking of demoBookings) {
  const client = demoClients.find((candidate) => candidate.email === booking.clientEmail);
  if (!client) {
    throw new Error(`No demo client metadata found for ${booking.clientEmail}`);
  }

  const clientId = findMapValue(usersByEmail, booking.clientEmail, "demo client");
  const therapistId = findMapValue(therapistIds, booking.therapistSlug, "therapist");
  const service = findMapValue(serviceByCode, booking.serviceCode, "service");

  await upsertAppointment(
    {
      ...booking,
      clientName: client.fullName,
      clientPhone: client.phone,
    },
    clientId.id,
    therapistId,
    service,
  );

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id")
    .eq("booking_reference", booking.bookingReference)
    .single();

  if (appointmentError) throw appointmentError;

  if (booking.paymentKind) {
    await seedPaymentFlow(
      booking,
      appointment.id,
      service.price_ngn ? Number(service.price_ngn) * 100 : 0,
    );
  }

  console.log(`Seeded demo booking ${booking.bookingReference}`);
}

console.log(`Done. ${demoBookings.length} demo bookings are ready for testing.`);
