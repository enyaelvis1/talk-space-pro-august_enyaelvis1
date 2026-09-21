import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { createRequestSupabase } from "@/lib/supabase-server";
import type { Database, Json } from "@/integrations/supabase/types";
import { canonicalUrl } from "@/lib/seo";
import {
  validateProviderPayment,
  paymentReceipt,
  readPaymentReceipt,
  type PaymentReceipt,
} from "@/lib/payment-validation";
import { isMissingInPersonPriceColumn, resolveServicePriceNgn } from "@/lib/service-pricing";
import { getClientContactCompletionState } from "@/lib/clients.functions";
import { clientPhoneSchema } from "@/lib/client-profile";
import {
  assertCheckoutOpen,
  isBookingTokenActive,
  type BookingTokenLifecycle,
} from "@/lib/booking-token-lifecycle";
import { requireRequestRole } from "@/lib/server-auth";

function bag() {
  const r = createRequestSupabase(getRequest());
  if (!r) throw new Error("Supabase is not configured.");
  return r;
}

async function requireAdmin() {
  const context = await requireRequestRole("admin");
  return {
    userId: context.user.id,
    client: context.bag.client,
    commitCookies: context.bag.commitCookies,
  };
}

function noStore() {
  setResponseHeader("Cache-Control", "private, no-store");
}

function throwPaystackAdminVerificationError(
  phase: "checkout" | "provider" | "validation",
  error: unknown,
): never {
  const raw = error instanceof Error ? error.message : String(error);
  console.error("[payments] admin Paystack verification failed", { phase, error: raw });

  if (phase === "checkout") {
    throw new Error(
      "Paystack checkout could not be matched to this payment. Confirm the stored reference and review the checkout record before retrying.",
    );
  }
  if (phase === "validation") {
    if (raw.includes("amount")) {
      throw new Error(
        "Paystack amount does not match the stored booking total. Do not confirm this payment; review the provider transaction and booking.",
      );
    }
    if (raw.includes("currency")) {
      throw new Error(
        "Paystack currency does not match the stored booking currency. Do not confirm this payment; review the provider transaction and booking.",
      );
    }
    if (raw.includes("reference")) {
      throw new Error(
        "Paystack reference does not match the stored checkout. Do not confirm this payment; review the provider transaction.",
      );
    }
    throw new Error(
      "Paystack verification details do not match the stored booking. Do not confirm this payment; review it manually.",
    );
  }

  if (raw.includes("paystack_verify_failed:401") || raw.includes("paystack_verify_failed:404")) {
    throw new Error(
      "Paystack could not find this reference. Confirm the stored secret key belongs to the same test/live Paystack account that created the payment.",
    );
  }
  throw new Error(
    "Paystack could not verify this payment right now. Confirm the provider reference and retry, or review it manually.",
  );
}

function hashToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

async function syncGoogleBeforePaymentEmail(appointmentId: string | null | undefined) {
  if (!appointmentId) return;
  try {
    const { syncAppointmentToGoogle } = await import("@/lib/google.functions");
    await syncAppointmentToGoogle(appointmentId);
  } catch (err) {
    console.error("[payments] google sync failed:", err);
  }
}

async function syncGoogleForPaymentReference(reference: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payments")
    .select("appointment_id")
    .or(`reference.eq.${reference},checkout_group_reference.eq.${reference}`);
  await Promise.all(
    (data ?? []).map((payment) =>
      syncGoogleBeforePaymentEmail(payment.appointment_id as string | null),
    ),
  );
}

export async function findExistingClientForPaymentSync(
  client: Pick<import("@supabase/supabase-js").SupabaseClient<Database>, "from">,
  input: { clientId?: string | null; email?: string | null; phone?: string | null },
) {
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  const phone = String(input.phone ?? "").trim();

  if (input.clientId) {
    const { data, error } = await client
      .from("clients")
      .select(
        "id, email, phone, full_name, preferred_mode, record_source, surname, other_names, address, date_of_birth, wedding_anniversary_date, occupation",
      )
      .eq("id", input.clientId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const results: Array<Record<string, unknown>> = [];
  if (email) {
    const { data, error } = await client
      .from("clients")
      .select(
        "id, email, phone, full_name, preferred_mode, record_source, surname, other_names, address, date_of_birth, wedding_anniversary_date, occupation",
      )
      .eq("email", email)
      .limit(20);
    if (error) throw error;
    results.push(...(data ?? []));
  }
  if (phone) {
    const { data, error } = await client
      .from("clients")
      .select(
        "id, email, phone, full_name, preferred_mode, record_source, surname, other_names, address, date_of_birth, wedding_anniversary_date, occupation",
      )
      .eq("phone", phone)
      .limit(20);
    if (error) throw error;
    results.push(...(data ?? []));
  }

  if (results.length === 0) return null;

  const score = (row: Record<string, unknown>) => {
    let total = 0;
    if (
      String(row.email ?? "")
        .trim()
        .toLowerCase() === email
    )
      total += 3;
    if (String(row.phone ?? "").trim() === phone) total += 3;
    if (String(row.full_name ?? "").trim()) total += 1;
    if (String(row.record_source ?? "").trim()) total += 1;
    return total;
  };

  return (
    [...results].sort(
      (a, b) => score(b as Record<string, unknown>) - score(a as Record<string, unknown>),
    )[0] ?? null
  );
}

export function buildPaymentSyncClientPayload(input: {
  resolvedClientId: string;
  existingClient: Record<string, unknown> | null;
  fullName: string;
  email: string;
  phone: string;
  preferredMode: "online" | "in_person" | "phone";
}): Database["public"]["Tables"]["clients"]["Insert"] {
  const existing = input.existingClient ?? {};
  const existingText = (field: string) =>
    typeof existing[field] === "string" ? existing[field] : null;
  const finalFullName = input.fullName || String(existing.full_name ?? "").trim() || null;
  const finalEmail =
    input.email ||
    String(existing.email ?? "")
      .trim()
      .toLowerCase() ||
    null;
  const finalPhone = input.phone || String(existing.phone ?? "").trim() || null;

  return {
    id: input.resolvedClientId,
    email: finalEmail,
    full_name: finalFullName,
    phone: finalPhone,
    preferred_mode: input.preferredMode,
    record_source: existingText("record_source") ?? "payment_confirmation",
    surname: existingText("surname"),
    other_names: existingText("other_names"),
    address: existingText("address"),
    date_of_birth: existingText("date_of_birth"),
    wedding_anniversary_date: existingText("wedding_anniversary_date"),
    occupation: existingText("occupation"),
  };
}

async function findAuthUserIdByEmail(
  client: Pick<import("@supabase/supabase-js").SupabaseClient<Database>, "auth">,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
    if (user?.id) return user.id;
    if (data.users.length < 1000) return null;
  }
}

type PaymentClientMode = "online" | "in_person" | "phone";

async function syncPaidClient(input: {
  client: Pick<import("@supabase/supabase-js").SupabaseClient<Database>, "from" | "auth">;
  clientId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  preferredMode: PaymentClientMode;
}): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const existingClient = await findExistingClientForPaymentSync(input.client, {
    clientId: input.clientId,
    email,
    phone,
  });
  const resolvedClientId =
    (existingClient?.id as string | null) ??
    input.clientId ??
    (await findAuthUserIdByEmail(input.client, email));
  if (!resolvedClientId) return null;

  const mergedState = getClientContactCompletionState({
    fullName: input.fullName || String(existingClient?.full_name ?? "").trim(),
    email:
      email ||
      String(existingClient?.email ?? "")
        .trim()
        .toLowerCase(),
    phone: phone || String(existingClient?.phone ?? "").trim(),
  });
  if (!mergedState.isComplete) {
    console.warn("[payments] skipping client sync for incomplete client profile:", {
      resolvedClientId,
      missing: mergedState.missing,
    });
    return null;
  }

  const payload = buildPaymentSyncClientPayload({
    resolvedClientId,
    existingClient,
    fullName: mergedState.fullName,
    email: mergedState.email,
    phone: mergedState.phone,
    preferredMode: input.preferredMode,
  });
  const { error } = await input.client.from("clients").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return resolvedClientId;
}

export async function syncClientRecordsForSuccessfulPayment(reference: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payments, error: paymentQueryError } = await supabaseAdmin
    .from("payments")
    .select("appointment_id, payment_kind, metadata")
    .eq("status", "succeeded")
    .or(`reference.eq.${reference},checkout_group_reference.eq.${reference}`);
  if (paymentQueryError) throw paymentQueryError;

  const appointmentIds = [
    ...new Set(
      (payments ?? [])
        .map((payment) => payment.appointment_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: appointments, error: appointmentQueryError } = appointmentIds.length
    ? await supabaseAdmin
        .from("appointments")
        .select("id, client_id, client_name, client_email, client_phone, session_mode")
        .in("id", appointmentIds)
    : { data: [], error: null };
  if (appointmentQueryError) throw appointmentQueryError;

  for (const appointment of appointments ?? []) {
    const resolvedClientId = await syncPaidClient({
      client: supabaseAdmin,
      clientId: (appointment.client_id as string | null) ?? null,
      fullName: String(appointment.client_name ?? "").trim(),
      email: String(appointment.client_email ?? ""),
      phone: String(appointment.client_phone ?? ""),
      preferredMode: String(appointment.session_mode ?? "online") as PaymentClientMode,
    });
    if (!appointment.client_id && resolvedClientId) {
      const { error } = await supabaseAdmin
        .from("appointments")
        .update({ client_id: resolvedClientId })
        .eq("id", appointment.id);
      if (error) throw error;
    }
  }

  for (const payment of payments ?? []) {
    if (payment.payment_kind !== "package_purchase") continue;
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    await syncPaidClient({
      client: supabaseAdmin,
      clientId: typeof metadata.client_id === "string" ? metadata.client_id : null,
      fullName: String(metadata.client_name ?? ""),
      email: String(metadata.client_email ?? ""),
      phone: String(metadata.client_phone ?? ""),
      preferredMode: String(metadata.session_mode ?? "online") as PaymentClientMode,
    });
  }
}

export async function sendPaymentEmailsForReference(
  reference: string,
  templateKey: "payment_success" | "payment_failed" | "bank_transfer_received",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPaymentEmail } = await import("@/lib/payment-email.server");
  const { data } = await supabaseAdmin
    .from("payments")
    .select(
      "id, appointment_id, appointments(id, booking_reference, client_name, client_email, client_phone, starts_at, session_mode, status, services(name), therapists(full_name))",
    )
    .or(`reference.eq.${reference},checkout_group_reference.eq.${reference}`);
  for (const payment of data ?? []) {
    await sendPaymentEmail({ paymentId: payment.id as string, templateKey });
    if (templateKey === "payment_success" && payment.appointment_id) {
      try {
        const { sendTherapistBookingEmail } = await import("@/lib/therapist-email.server");
        await sendTherapistBookingEmail(payment.appointment_id as string);
      } catch (err) {
        console.error("[payments] therapist email failed:", err);
      }
    }
    if (templateKey === "payment_success") {
      const appointment = payment.appointments as {
        booking_reference?: string;
        client_name?: string;
        client_email?: string;
        client_phone?: string;
        starts_at?: string;
        session_mode?: string;
        status?: string;
        services?: { name?: string } | null;
        therapists?: { full_name?: string } | null;
      } | null;
      if (appointment?.status === "confirmed") {
        try {
          const { loadEmailSettings, sendTemplateEmail } = await import("@/lib/email.server");
          const settings = await loadEmailSettings();
          const inbox = settings.contactInbox || settings.fromEmail;
          if (inbox) {
            await sendTemplateEmail(
              "booking_admin_notice",
              inbox,
              {
                clientName: appointment.client_name ?? "",
                clientEmail: appointment.client_email ?? "",
                clientPhone: appointment.client_phone ?? "",
                reference: appointment.booking_reference ?? reference,
                serviceName: appointment.services?.name ?? "Session",
                therapistName: appointment.therapists?.full_name ?? "To be assigned",
                startsAt: appointment.starts_at ?? "",
                mode: appointment.session_mode ?? "",
                status: appointment.status,
                paymentStatus: "Paid and confirmed",
                adminUrl: canonicalUrl("/admin/bookings"),
              },
              { replyTo: appointment.client_email ?? settings.replyTo },
            );
          }
        } catch (err) {
          console.error("[payments] internal booking notice failed:", err);
        }
      }
    }
  }
}

type ManageTokenLifecycle = BookingTokenLifecycle & {
  manage_token_hash: string;
  manage_token_expires_at?: string | null;
  manage_token_revoked_at?: string | null;
  status?: string | null;
};

function hasActiveManageToken(row: ManageTokenLifecycle, token: string | undefined) {
  if (!token) return false;
  if (hashToken(token) !== row.manage_token_hash) return false;
  return isBookingTokenActive(row);
}

export type PaymentSettingsDTO = {
  mode: "test" | "live";
  paystackPublicKey: string | null;
  paystackSecretLast4: string | null;
  hasPaystackSecret: boolean;
  paystackSecretSource: "supabase" | "environment" | null;
  hasPaystackWebhookSecret: boolean;
  isPaystackEnabled: boolean;
  isBankTransferEnabled: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankInstructions: string | null;
  callbackPath: string;
  updatedAt: string;
};

export type PublicPaymentOptions = {
  mode: "test" | "live";
  isPaystackEnabled: boolean;
  paystackPublicKey: string | null;
  isBankTransferEnabled: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankInstructions: string | null;
};

export type PackageServiceOption = {
  id: string;
  name: string;
  sessionsPerPackage: number;
  priceNgn: number | null;
};

export type ManualPackageLinkResult = {
  packageId: string;
  packageReference: string;
  bookingUrl: string | null;
  remainingSessions: number;
};

async function loadPaymentAdminData(): Promise<PaymentSettingsDTO> {
  const { loadPaymentSettings } = await import("@/lib/payments.server");
  const s = await loadPaymentSettings();
  noStore();
  return s as PaymentSettingsDTO;
}

export const getPaymentAdminData = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentSettingsDTO> => {
    await requireAdmin();
    return loadPaymentAdminData();
  },
);

export const getPublicPaymentOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPaymentOptions> => {
    const { loadPaymentSettings } = await import("@/lib/payments.server");
    const s = await loadPaymentSettings();
    noStore();
    return {
      mode: s.mode,
      isPaystackEnabled: s.isPaystackEnabled && Boolean(s.paystackPublicKey),
      paystackPublicKey: s.paystackPublicKey,
      isBankTransferEnabled: s.isBankTransferEnabled,
      bankName: s.bankName,
      bankAccountName: s.bankAccountName,
      bankAccountNumber: s.bankAccountNumber,
      bankInstructions: s.bankInstructions,
    };
  },
);

async function loadPackageServicesForAdmin(): Promise<PackageServiceOption[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id, name, sessions_per_package, price_ngn")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  noStore();
  return (data ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    sessionsPerPackage: Number(service.sessions_per_package ?? 1),
    priceNgn: service.price_ngn == null ? null : Number(service.price_ngn),
  }));
}

export const listPackageServicesForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<PackageServiceOption[]> => {
    await requireAdmin();
    return loadPackageServicesForAdmin();
  },
);

export type PaymentAdminSetupWorkspace = {
  settings: PaymentSettingsDTO;
  packageServices: PackageServiceOption[];
};

export const getPaymentAdminSetupWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentAdminSetupWorkspace> => {
    await requireAdmin();
    const [settings, packageServices] = await Promise.all([
      loadPaymentAdminData(),
      loadPackageServicesForAdmin(),
    ]);
    return { settings, packageServices };
  },
);

const manualPackageInput = z.object({
  clientName: z.string().trim().min(2).max(100),
  clientEmail: z.string().trim().email().max(255),
  clientPhone: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    clientPhoneSchema.optional(),
  ),
  serviceId: z.string().uuid(),
  sessionMode: z.enum(["online", "in_person"]),
  purchasedSessions: z.number().int().min(1).max(50),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(1000).optional(),
  sendEmail: z.boolean().default(true),
});

export const createManualPackageLink = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof manualPackageInput>) => manualPackageInput.parse(d))
  .handler(async ({ data }): Promise<ManualPackageLinkResult> => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, name, sessions_per_package")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service) throw new Error("Service not found.");
    const sessions = data.purchasedSessions;
    const { createManualSessionPackage } = await import("@/lib/session-packages.server");
    const result = await createManualSessionPackage({
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      serviceId: data.serviceId,
      sessionMode: data.sessionMode,
      purchasedSessions: sessions,
      expiresAt: data.expiresAt,
      notes: data.notes,
      createdBy: userId,
    });

    if (data.sendEmail && result.bookingUrl) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email.server");
        await sendTemplateEmail("package_booking_link", data.clientEmail, {
          clientName: data.clientName,
          serviceName: service.name,
          purchasedSessions: sessions,
          remainingSessions: result.remainingSessions,
          packageReference: result.packageReference,
          expiresAt: data.expiresAt,
          packageBookingUrl: result.bookingUrl,
        });
      } catch (err) {
        console.error("[payments] manual package email failed:", err);
      }
    }

    noStore();
    return {
      packageId: result.packageId,
      packageReference: result.packageReference,
      bookingUrl: result.bookingUrl,
      remainingSessions: result.remainingSessions,
    };
  });

const settingsInput = z.object({
  mode: z.enum(["test", "live"]),
  paystackPublicKey: z.string().trim().max(200).nullable().optional(),
  isPaystackEnabled: z.boolean(),
  isBankTransferEnabled: z.boolean(),
  bankName: z.string().trim().max(200).nullable().optional(),
  bankAccountName: z.string().trim().max(200).nullable().optional(),
  bankAccountNumber: z.string().trim().max(40).nullable().optional(),
  bankInstructions: z.string().trim().max(1000).nullable().optional(),
  callbackPath: z.string().trim().min(1).max(200).default("/book/payment-callback"),
});

export const updatePaymentSettings = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof settingsInput>) => settingsInput.parse(data))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_settings").upsert(
      {
        id: 1,
        mode: data.mode,
        paystack_public_key: data.paystackPublicKey || null,
        is_paystack_enabled: data.isPaystackEnabled,
        is_bank_transfer_enabled: data.isBankTransferEnabled,
        bank_name: data.bankName || null,
        bank_account_name: data.bankAccountName || null,
        bank_account_number: data.bankAccountNumber || null,
        bank_instructions: data.bankInstructions || null,
        callback_path: data.callbackPath,
        updated_by: userId,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return { ok: true };
  });

const secretInput = z.object({ value: z.string().trim().min(10).max(512) });

export const setPaystackSecret = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof secretInput>) => secretInput.parse(d))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { encryptSecret } = await import("@/lib/payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_settings").upsert(
      {
        id: 1,
        paystack_secret_ciphertext: encryptSecret(data.value),
        paystack_secret_last4: data.value.slice(-4),
        updated_by: userId,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return { ok: true, last4: data.value.slice(-4) };
  });

export const clearPaystackSecret = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("payment_settings").upsert(
    {
      id: 1,
      paystack_secret_ciphertext: null,
      paystack_secret_last4: null,
      updated_by: userId,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  return { ok: true };
});

export const setPaystackWebhookSecret = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof secretInput>) => secretInput.parse(d))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { encryptSecret } = await import("@/lib/payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_settings").upsert(
      {
        id: 1,
        paystack_webhook_secret_ciphertext: encryptSecret(data.value),
        updated_by: userId,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const clearPaystackWebhookSecret = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("payment_settings")
    .upsert(
      { id: 1, paystack_webhook_secret_ciphertext: null, updated_by: userId },
      { onConflict: "id" },
    );
  if (error) throw error;
  return { ok: true };
});

const initPaystackInput = z
  .object({
    appointmentId: z.string().uuid().optional(),
    appointmentIds: z.array(z.string().uuid()).min(1).max(10).optional(),
    manageToken: z.string().trim().min(16).max(128).optional(),
    manageTokens: z
      .array(
        z.object({
          appointmentId: z.string().uuid(),
          manageToken: z.string().trim().min(16).max(128),
        }),
      )
      .min(1)
      .max(10)
      .optional(),
  })
  .refine((data) => Boolean(data.appointmentId) !== Boolean(data.appointmentIds), {
    message: "Choose one booking or a group of bookings.",
  });

export type InitPaystackResult = {
  reference: string;
  authorizationUrl: string;
  publicKey: string | null;
  amountKobo: number;
};

export const initPaystackPayment = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof initPaystackInput>) => initPaystackInput.parse(d))
  .handler(async ({ data }): Promise<InitPaystackResult> => {
    const r = bag();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      loadPaymentSettings,
      loadPaystackSecret,
      paystackInitialize,
      generatePaymentReference,
    } = await import("@/lib/payments.server");

    const settings = await loadPaymentSettings();
    if (!settings.isPaystackEnabled) throw new Error("Paystack is not enabled.");
    const secret = await loadPaystackSecret();
    if (!secret) throw new Error("Paystack secret key is not configured.");

    const appointmentIds = data.appointmentIds ?? (data.appointmentId ? [data.appointmentId] : []);
    let appointmentResult = await supabaseAdmin
      .from("appointments")
      .select(
        "id, booking_reference, client_email, client_id, manage_token_hash, manage_token_expires_at, manage_token_revoked_at, created_at, hold_expires_at, service_id, session_mode, services(code, price_ngn, in_person_price_ngn, name), status",
      )
      .in("id", appointmentIds);
    if (isMissingInPersonPriceColumn(appointmentResult.error)) {
      const fallback = await supabaseAdmin
        .from("appointments")
        .select(
          "id, booking_reference, client_email, client_id, manage_token_hash, manage_token_expires_at, manage_token_revoked_at, created_at, hold_expires_at, service_id, session_mode, services(code, price_ngn, name), status",
        )
        .in("id", appointmentIds);
      appointmentResult = fallback.error
        ? fallback
        : {
            ...fallback,
            data: fallback.data.map((row) => ({
              ...row,
              services: { ...row.services, in_person_price_ngn: null },
            })),
          };
    }
    const { data: appts, error } = appointmentResult;
    if (error) throw error;
    if (!appts?.length || appts.length !== appointmentIds.length)
      throw new Error("Appointment not found.");

    const {
      data: { user },
    } = await r.client.auth.getUser();
    const first = appts[0];
    const firstServiceId = first.service_id as string;
    const firstMode = first.session_mode as string;
    const firstEmail = first.client_email as string;
    for (const appt of appts) {
      assertCheckoutOpen(appt);
      const ownsAppt = user && appt.client_id === user.id;
      const groupToken = data.manageTokens?.find((item) => item.appointmentId === appt.id);
      const tokenMatch = hasActiveManageToken(
        appt,
        data.appointmentId ? data.manageToken : groupToken?.manageToken,
      );
      if (!ownsAppt && !tokenMatch) {
        r.commitCookies();
        throw new Error("You don't have permission to pay for this booking.");
      }
      if (appt.status !== "hold" && appt.status !== "pending_payment") {
        throw new Error("This booking can't be paid in its current state.");
      }
      if (appt.service_id !== firstServiceId || appt.session_mode !== firstMode) {
        throw new Error("Grouped checkout must use one service and one session mode.");
      }
      if (appt.client_email !== firstEmail) {
        throw new Error("Grouped checkout must belong to one client.");
      }
    }

    const prices = appts.map((appt) =>
      resolveServicePriceNgn(
        appt.services as {
          code?: string | null;
          price_ngn?: number | null;
          in_person_price_ngn?: number | null;
        } | null,
        appt.session_mode as string | null,
      ),
    );
    if (prices.some((price) => price == null)) {
      throw new Error("This service does not have a configured price.");
    }
    const amountKobo = prices.reduce<number>(
      (sum, price) => sum + Math.round(Number(price) * 100),
      0,
    );
    if (amountKobo <= 0) throw new Error("Invalid amount.");

    const reference = generatePaymentReference("TSP");
    const origin = new URL(getRequest().url).origin;
    const callbackUrl = `${origin}${settings.callbackPath}?reference=${encodeURIComponent(reference)}`;

    const init = await paystackInitialize({
      secretKey: secret,
      email: firstEmail,
      amountKobo,
      reference,
      callbackUrl,
      metadata: {
        appointment_id: first.id,
        appointment_ids: appts.map((appt) => appt.id),
        booking_reference: appts.map((appt) => appt.booking_reference).join(", "),
        service: (first.services as { name?: string } | null)?.name,
        session_count: appts.length,
      },
    });

    for (let index = 0; index < appts.length; index += 1) {
      const appt = appts[index];
      const { data: paymentRow, error: rpcError } = await supabaseAdmin.rpc(
        "record_payment_initiated",
        {
          p_appointment_id: appt.id,
          p_provider: "paystack",
          p_reference: index === 0 ? reference : `${reference}-${index + 1}`,
          p_amount_kobo: Math.round(Number(prices[index]) * 100),
          p_authorization_url: init.authorizationUrl,
          p_metadata: {
            access_code: init.accessCode,
            callback_url: callbackUrl,
            checkout_group_reference: reference,
            session_count: appts.length,
          },
        },
      );
      if (rpcError) throw rpcError;
      const paymentId = (paymentRow as { id?: string } | null)?.id;
      if (!paymentId) throw new Error("Payment record was not created.");
      const { error: groupError } = await supabaseAdmin
        .from("payments")
        .update({ checkout_group_reference: reference })
        .eq("id", paymentId);
      if (groupError) throw groupError;
    }

    r.commitCookies();
    noStore();
    return {
      reference,
      authorizationUrl: init.authorizationUrl,
      publicKey: settings.paystackPublicKey,
      amountKobo,
    };
  });

const packagePurchaseInput = z.object({
  serviceId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().trim().min(2).max(120),
  clientEmail: z.string().trim().email().max(255),
  clientPhone: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    clientPhoneSchema.optional(),
  ),
  purchasedSessions: z.number().int().min(1).max(50),
  sessionMode: z.enum(["online", "in_person"]).optional(),
  preferredDate: z.string().trim().max(20).optional(),
  preferredTime: z.string().trim().max(80).optional(),
});

export const initPackagePurchasePayment = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof packagePurchaseInput>) => packagePurchaseInput.parse(d))
  .handler(async ({ data }): Promise<InitPaystackResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      loadPaymentSettings,
      loadPaystackSecret,
      paystackInitialize,
      generatePaymentReference,
    } = await import("@/lib/payments.server");

    const settings = await loadPaymentSettings();
    if (!settings.isPaystackEnabled) throw new Error("Paystack is not enabled.");
    const secret = await loadPaystackSecret();
    if (!secret) throw new Error("Paystack secret key is not configured.");

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, name, code, price_ngn, in_person_price_ngn, sessions_per_package")
      .eq("id", data.serviceId)
      .eq("is_active", true)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service) throw new Error("Service not found.");

    const configuredPrice = resolveServicePriceNgn(service, data.sessionMode);
    const configuredSessions = Math.max(1, Number(service.sessions_per_package ?? 1));
    const unitPrice = Number(configuredPrice ?? 0) / configuredSessions;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error("This service does not have a configured price.");
    }

    const amountKobo = Math.round(unitPrice * data.purchasedSessions * 100);
    const reference = generatePaymentReference("TSP");
    const origin = new URL(getRequest().url).origin;
    const callbackUrl = `${origin}${settings.callbackPath}?reference=${encodeURIComponent(reference)}`;

    const init = await paystackInitialize({
      secretKey: secret,
      email: data.clientEmail,
      amountKobo,
      reference,
      callbackUrl,
      metadata: {
        payment_kind: "package_purchase",
        service_id: data.serviceId,
        client_id: data.clientId ?? null,
        client_name: data.clientName,
        client_email: data.clientEmail,
        client_phone: data.clientPhone ?? null,
        purchased_sessions: data.purchasedSessions,
        session_mode: data.sessionMode ?? null,
        preferred_date: data.preferredDate || null,
        preferred_time: data.preferredTime || null,
      },
    });

    const { data: paymentRow, error: rpcError } = await supabaseAdmin.rpc(
      "record_package_purchase_initiated",
      {
        p_provider: "paystack",
        p_reference: reference,
        p_amount_kobo: amountKobo,
        p_service_id: data.serviceId,
        p_client_id: data.clientId ?? null,
        p_client_name: data.clientName,
        p_client_email: data.clientEmail,
        p_client_phone: data.clientPhone ?? null,
        p_metadata: {
          access_code: init.accessCode,
          callback_url: callbackUrl,
          purchased_sessions: data.purchasedSessions,
          service_name: service.name,
          session_mode: data.sessionMode ?? null,
          preferred_date: data.preferredDate || null,
          preferred_time: data.preferredTime || null,
        },
      },
    );
    if (rpcError) throw rpcError;
    if (!paymentRow) throw new Error("Package payment record was not created.");

    return {
      reference,
      authorizationUrl: init.authorizationUrl,
      publicKey: settings.paystackPublicKey,
      amountKobo,
    };
  });

const verifyInput = z.object({ reference: z.string().trim().min(4).max(120) });

export type VerifyPaystackResult = PaymentReceipt & {
  status: "succeeded" | "failed" | "pending";
  amountKobo: number;
  bookingReference: string | null;
  bookingReviewRequired: boolean;
  packageBookingUrl: string | null;
  packagePurchasedSessions: number | null;
  packageRemainingSessions: number | null;
};

async function loadPurchasePackage(paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildPackageBookingUrl } = await import("@/lib/session-packages.server");
  const packageClient = supabaseAdmin as unknown as {
    from: (table: "client_session_packages") => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
        };
      };
    };
  };
  const { data, error } = await packageClient
    .from("client_session_packages")
    .select("access_token, reference, purchased_sessions, used_sessions")
    .eq("source_payment_id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const purchased = Number(data.purchased_sessions ?? 0);
  const used = Number(data.used_sessions ?? 0);
  return {
    bookingUrl: buildPackageBookingUrl(data.access_token as string | null),
    packageReference: data.reference as string,
    purchasedSessions: purchased,
    remainingSessions: Math.max(0, purchased - used),
  };
}

async function sendPackagePurchaseEmail(
  paymentId: string,
  packageInfo: NonNullable<Awaited<ReturnType<typeof loadPurchasePackage>>>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("@/lib/email.server");
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("metadata, payment_success_email_claimed_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment || payment.payment_success_email_claimed_at) return;
  const metadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata
      : {};
  const email = typeof metadata.client_email === "string" ? metadata.client_email : "";
  if (!email) throw new Error("Package purchase email is missing.");
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("payments")
    .update({ payment_success_email_claimed_at: claimedAt })
    .eq("id", paymentId)
    .is("payment_success_email_claimed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;
  await sendTemplateEmail("package_booking_link", email, {
    clientName: typeof metadata.client_name === "string" ? metadata.client_name : "",
    serviceName: typeof metadata.service_name === "string" ? metadata.service_name : "",
    purchasedSessions: packageInfo.purchasedSessions,
    remainingSessions: packageInfo.remainingSessions,
    packageReference: packageInfo.packageReference,
    packageBookingUrl: packageInfo.bookingUrl ?? "",
  });
}

export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof verifyInput>) => verifyInput.parse(d))
  .handler(async ({ data }): Promise<VerifyPaystackResult> => {
    noStore();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPaystackSecret, paystackVerify } = await import("@/lib/payments.server");
    const { loadPaystackCheckout } = await import("@/lib/paystack-checkout.server");

    const checkout = await loadPaystackCheckout(data.reference);
    const { payment } = checkout;
    const packagePurchase = payment.payment_kind === "package_purchase";
    const storedReceipt = readPaymentReceipt(payment.metadata);
    if (
      checkout.alreadySucceeded &&
      storedReceipt &&
      storedReceipt.bookingAmountKobo === checkout.amountKobo &&
      storedReceipt.currency === checkout.currency
    ) {
      const packageInfo = packagePurchase ? await loadPurchasePackage(payment.id) : null;
      return {
        ...storedReceipt,
        bookingReviewRequired: checkout.bookingReviewRequired,
        status: "succeeded",
        bookingReference:
          (payment.appointments as { booking_reference?: string } | null)?.booking_reference ??
          null,
        packageBookingUrl: packageInfo?.bookingUrl ?? null,
        packagePurchasedSessions: packageInfo?.purchasedSessions ?? null,
        packageRemainingSessions: packageInfo?.remainingSessions ?? null,
      };
    }

    const secret = await loadPaystackSecret();
    if (!secret) throw new Error("Paystack secret key is not configured.");
    const verify = await paystackVerify({ secretKey: secret, reference: data.reference });
    validateProviderPayment({
      expectedAmountKobo: checkout.amountKobo,
      expectedCurrency: checkout.currency,
      expectedReference: data.reference,
      result: verify,
    });
    const newStatus =
      verify.status === "success"
        ? "succeeded"
        : verify.status === "failed" || verify.status === "abandoned"
          ? "failed"
          : "initiated";

    if (checkout.alreadySucceeded && newStatus !== "succeeded")
      throw new Error("Paystack status conflicts with the confirmed payment. Contact support.");
    const receipt = paymentReceipt(verify, checkout.amountKobo);
    if (newStatus !== "initiated") {
      const { error } = await supabaseAdmin.rpc("mark_payment_status", {
        p_reference: data.reference,
        p_new_status: newStatus,
        p_provider_reference: verify.providerReference,
        p_failed_reason: newStatus === "failed" ? (verify.status ?? undefined) : undefined,
        p_metadata: { verified_via: "callback", paystack_receipt: receipt },
      });
      if (error) throw error;
    }

    if (newStatus === "succeeded") {
      await syncClientRecordsForSuccessfulPayment(data.reference);
      await syncGoogleForPaymentReference(data.reference);
    }
    const packageInfo =
      newStatus === "succeeded" && packagePurchase ? await loadPurchasePackage(payment.id) : null;
    if (newStatus === "succeeded" || newStatus === "failed") {
      try {
        if (newStatus === "succeeded" && packageInfo) {
          await sendPackagePurchaseEmail(payment.id, packageInfo);
        } else {
          await sendPaymentEmailsForReference(
            data.reference,
            newStatus === "succeeded" ? "payment_success" : "payment_failed",
          );
        }
      } catch (err) {
        console.error("[payments] payment email failed:", err);
      }
    }

    return {
      ...receipt,
      bookingReviewRequired:
        newStatus === "succeeded"
          ? (await loadPaystackCheckout(data.reference)).bookingReviewRequired
          : false,
      status:
        newStatus === "succeeded" ? "succeeded" : newStatus === "failed" ? "failed" : "pending",
      amountKobo: verify.amountKobo,
      bookingReference:
        (payment.appointments as { booking_reference?: string } | null)?.booking_reference ?? null,
      packageBookingUrl: packageInfo?.bookingUrl ?? null,
      packagePurchasedSessions: packageInfo?.purchasedSessions ?? null,
      packageRemainingSessions: packageInfo?.remainingSessions ?? null,
    };
  });

const verifyPaystackAdminInput = z.object({ paymentId: z.string().uuid() });
const manualPaymentStatusInput = z.object({
  paymentId: z.string().uuid(),
  status: z.enum(["initiated", "awaiting_confirmation", "succeeded", "failed", "cancelled"]),
});

export type ManualPaymentStatusResult = {
  status: "initiated" | "awaiting_confirmation" | "succeeded" | "failed" | "cancelled";
};

export const verifyPaystackPaymentForAdmin = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof verifyPaystackAdminInput>) => verifyPaystackAdminInput.parse(d))
  .handler(async ({ data }): Promise<VerifyPaystackResult> => {
    await requireAdmin();
    noStore();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPaystackSecret, paystackVerify } = await import("@/lib/payments.server");
    const { loadPaystackCheckout } = await import("@/lib/paystack-checkout.server");

    const secret = await loadPaystackSecret();
    if (!secret) throw new Error("Paystack secret key is not configured.");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("reference, checkout_group_reference, provider")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!payment) throw new Error("Payment not found.");

    if (payment.provider !== "paystack") throw new Error("This is not a Paystack payment.");
    const reference = payment.checkout_group_reference ?? payment.reference;
    if (!reference?.trim()) {
      throw new Error(
        "Paystack reference is missing from this payment. Review the payment record before retrying.",
      );
    }
    let checkout;
    try {
      checkout = await loadPaystackCheckout(reference);
    } catch (error) {
      throwPaystackAdminVerificationError("checkout", error);
    }
    const storedReceipt = readPaymentReceipt(checkout.payment.metadata);
    if (
      checkout.alreadySucceeded &&
      storedReceipt &&
      storedReceipt.bookingAmountKobo === checkout.amountKobo &&
      storedReceipt.currency === checkout.currency
    ) {
      return {
        ...storedReceipt,
        bookingReviewRequired: checkout.bookingReviewRequired,
        status: "succeeded",
        bookingReference:
          (checkout.payment.appointments as { booking_reference?: string } | null)
            ?.booking_reference ?? null,
        packageBookingUrl: null,
        packagePurchasedSessions: null,
        packageRemainingSessions: null,
      };
    }

    let verify;
    try {
      verify = await paystackVerify({ secretKey: secret, reference });
    } catch (error) {
      throwPaystackAdminVerificationError("provider", error);
    }
    try {
      validateProviderPayment({
        expectedAmountKobo: checkout.amountKobo,
        expectedCurrency: checkout.currency,
        expectedReference: reference,
        result: verify,
      });
    } catch (error) {
      throwPaystackAdminVerificationError("validation", error);
    }
    const newStatus =
      verify.status === "success"
        ? "succeeded"
        : verify.status === "failed" || verify.status === "abandoned"
          ? "failed"
          : "initiated";

    if (checkout.alreadySucceeded && newStatus !== "succeeded")
      throw new Error("Paystack status conflicts with the confirmed payment. Contact support.");
    const receipt = paymentReceipt(verify, checkout.amountKobo);
    if (newStatus !== "initiated") {
      const { error } = await supabaseAdmin.rpc("mark_payment_status", {
        p_reference: reference,
        p_new_status: newStatus,
        p_provider_reference: verify.providerReference,
        p_failed_reason: newStatus === "failed" ? (verify.status ?? undefined) : undefined,
        p_metadata: { verified_via: "admin_recheck", paystack_receipt: receipt },
      });
      if (error) throw error;
    }

    if (newStatus === "succeeded") {
      await syncClientRecordsForSuccessfulPayment(reference);
      await syncGoogleForPaymentReference(reference);
    }
    if (newStatus === "succeeded" || newStatus === "failed") {
      try {
        await sendPaymentEmailsForReference(
          reference,
          newStatus === "succeeded" ? "payment_success" : "payment_failed",
        );
      } catch (err) {
        console.error("[payments] payment email failed:", err);
      }
    }

    noStore();
    return {
      ...receipt,
      bookingReviewRequired:
        newStatus === "succeeded"
          ? (await loadPaystackCheckout(reference)).bookingReviewRequired
          : false,
      status:
        newStatus === "succeeded" ? "succeeded" : newStatus === "failed" ? "failed" : "pending",
      amountKobo: verify.amountKobo,
      bookingReference:
        (checkout.payment.appointments as { booking_reference?: string } | null)
          ?.booking_reference ?? null,
      packageBookingUrl: null,
      packagePurchasedSessions: null,
      packageRemainingSessions: null,
    };
  });

export const updatePaymentStatusForAdmin = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof manualPaymentStatusInput>) => manualPaymentStatusInput.parse(d))
  .handler(async ({ data }): Promise<ManualPaymentStatusResult> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, appointment_id, provider, reference, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!payment) throw new Error("Payment not found.");

    const previousStatus = String(payment.status);
    if (previousStatus === data.status) {
      noStore();
      return { status: data.status };
    }

    const metadata = {
      verified_via: "admin_manual_status",
      previous_status: previousStatus,
    };
    const { error: statusError } = await supabaseAdmin.rpc("mark_payment_status", {
      p_reference: payment.reference as string,
      p_new_status: data.status,
      p_provider_reference: undefined,
      p_failed_reason: data.status === "failed" ? "admin_marked_failed" : undefined,
      p_metadata: metadata,
    });
    if (statusError) throw statusError;

    if (data.status === "succeeded") {
      await syncClientRecordsForSuccessfulPayment(payment.reference as string);
      await syncGoogleForPaymentReference(payment.reference as string);
    }

    if (
      (data.status === "succeeded" || data.status === "failed") &&
      previousStatus !== data.status
    ) {
      try {
        await sendPaymentEmailsForReference(
          payment.reference as string,
          data.status === "succeeded" ? "payment_success" : "payment_failed",
        );
      } catch (err) {
        console.error("[payments] manual status email failed:", err);
      }
    }

    noStore();
    return { status: data.status };
  });

const bankInput = z
  .object({
    appointmentId: z.string().uuid().optional(),
    appointmentIds: z.array(z.string().uuid()).min(1).max(10).optional(),
    manageToken: z.string().trim().min(16).max(128).optional(),
    manageTokens: z
      .array(
        z.object({
          appointmentId: z.string().uuid(),
          manageToken: z.string().trim().min(16).max(128),
        }),
      )
      .min(1)
      .max(10)
      .optional(),
    transferNote: z.string().trim().max(500).optional(),
    transferReference: z.string().trim().min(1, "Enter your bank transfer reference.").max(200),
    receiptPath: z.string().trim().max(500).optional(),
  })
  .refine((data) => Boolean(data.appointmentId) !== Boolean(data.appointmentIds), {
    message: "Choose one booking or a group of bookings.",
  });

const receiptUploadInput = z.object({
  appointmentId: z.string().uuid(),
  manageToken: z.string().trim().min(16).max(128).optional(),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  fileBase64: z.string().min(4).max(9_000_000), // ~6.5 MB decoded
});

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type UploadReceiptResult = { path: string };

export const uploadReceiptWithToken = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof receiptUploadInput>) => receiptUploadInput.parse(d))
  .handler(async ({ data }): Promise<UploadReceiptResult> => {
    const contentType = data.contentType.toLowerCase();
    if (!ALLOWED_RECEIPT_TYPES.has(contentType)) {
      throw new Error("Unsupported file type. Upload a PNG, JPG, WEBP, HEIC or PDF.");
    }

    const buffer = Buffer.from(data.fileBase64, "base64");
    if (buffer.length === 0) throw new Error("The uploaded file is empty.");
    if (buffer.length > MAX_RECEIPT_BYTES) {
      throw new Error("File is too large. Please upload a receipt under 5 MB.");
    }

    const r = bag();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, client_id, manage_token_hash, manage_token_expires_at, manage_token_revoked_at, status, created_at, hold_expires_at",
      )
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (error) throw error;
    if (!appt) throw new Error("Appointment not found.");
    assertCheckoutOpen(appt);

    const {
      data: { user },
    } = await r.client.auth.getUser();
    r.commitCookies();
    const ownsAppt = user && appt.client_id === user.id;
    const tokenMatch = hasActiveManageToken(appt, data.manageToken);
    if (!ownsAppt && !tokenMatch) {
      throw new Error("You don't have permission to upload a receipt for this booking.");
    }

    const extFromName = data.filename.includes(".")
      ? data.filename
          .split(".")
          .pop()!
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 8)
      : "";
    const extFromType =
      contentType === "application/pdf"
        ? "pdf"
        : contentType.startsWith("image/")
          ? contentType.slice(6).replace(/[^a-z0-9]/g, "")
          : "";
    const ext = extFromName || extFromType || "bin";
    const path = `${appt.id}/${Date.now()}-${randomFileToken()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-receipts")
      .upload(path, buffer, {
        contentType,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Couldn't store the receipt: ${uploadError.message}`);
    }

    noStore();
    return { path };
  });

function randomFileToken() {
  return createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 8);
}

export type SubmitBankTransferResult = {
  ok: true;
  reference: string;
  amountKobo: number;
  bookingReference: string;
  payment: Json;
};

type BankTransferAppointment = Pick<
  Database["public"]["Tables"]["appointments"]["Row"],
  | "id"
  | "booking_reference"
  | "service_id"
  | "session_mode"
  | "manage_token_hash"
  | "manage_token_expires_at"
  | "manage_token_revoked_at"
  | "created_at"
  | "hold_expires_at"
  | "status"
> & {
  services: { code: string; price_ngn: number | null; in_person_price_ngn?: number | null } | null;
};

export const submitBankTransfer = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof bankInput>) => bankInput.parse(d))
  .handler(async ({ data }): Promise<SubmitBankTransferResult> => {
    const r = bag();
    const { generatePaymentReference } = await import("@/lib/payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const appointmentIds = data.appointmentIds ?? (data.appointmentId ? [data.appointmentId] : []);
    let appointmentResult = await supabaseAdmin
      .from("appointments")
      .select(
        "id, booking_reference, service_id, session_mode, manage_token_hash, manage_token_expires_at, manage_token_revoked_at, status, created_at, hold_expires_at, services(code, price_ngn, in_person_price_ngn)",
      )
      .in("id", appointmentIds)
      .returns<BankTransferAppointment[]>();
    if (isMissingInPersonPriceColumn(appointmentResult.error)) {
      appointmentResult = await supabaseAdmin
        .from("appointments")
        .select(
          "id, booking_reference, service_id, session_mode, manage_token_hash, manage_token_expires_at, manage_token_revoked_at, status, created_at, hold_expires_at, services(code, price_ngn)",
        )
        .in("id", appointmentIds)
        .returns<BankTransferAppointment[]>();
    }
    const { data: appts, error } = appointmentResult;
    if (error) throw error;
    if (!appts?.length || appts.length !== appointmentIds.length)
      throw new Error("Appointment not found.");
    const first = appts[0];
    for (const appt of appts) {
      assertCheckoutOpen(appt);
      const groupToken = data.manageTokens?.find((item) => item.appointmentId === appt.id);
      const token = data.appointmentId ? data.manageToken : groupToken?.manageToken;
      if (!hasActiveManageToken(appt as ManageTokenLifecycle, token)) {
        throw new Error("You don't have permission to record this transfer.");
      }
    }
    if (
      appts.some(
        (appt) => appt.service_id !== first.service_id || appt.session_mode !== first.session_mode,
      )
    ) {
      throw new Error("Grouped checkout must use one service and one session mode.");
    }
    const prices = appts.map((appt) =>
      resolveServicePriceNgn(
        appt.services as {
          code?: string | null;
          price_ngn?: number | null;
          in_person_price_ngn?: number | null;
        } | null,
        appt.session_mode as string | null,
      ),
    );
    if (prices.some((price) => price == null)) {
      throw new Error("This service does not have a configured price.");
    }
    const amountKobo = prices.reduce<number>(
      (sum, price) => sum + Math.round(Number(price) * 100),
      0,
    );
    const reference = generatePaymentReference("TSB");

    let rpcData: Json = null;
    // Combine transfer note and explicit transfer reference (if provided) so admins can see both.
    const baseNote = data.transferNote?.trim() || undefined;
    const noteWithRef = data.transferReference
      ? `${baseNote ? baseNote + " " : ""}[transfer_ref:${data.transferReference.trim()}]`
      : baseNote;
    const transferRef = data.transferReference?.trim() || undefined;

    for (let index = 0; index < appts.length; index += 1) {
      const appt = appts[index];
      const { data: row, error: rpcErr } = await r.client.rpc("submit_bank_transfer", {
        p_appointment_id: appt.id,
        p_reference: index === 0 ? reference : `${reference}-${index + 1}`,
        p_amount_kobo: Math.round(Number(prices[index]) * 100),
        p_transfer_note: noteWithRef ?? undefined,
        p_transfer_reference: transferRef ?? undefined,
        p_receipt_path: index === 0 ? (data.receiptPath ?? undefined) : undefined,
        p_manage_token_hash: hashToken(
          data.appointmentId
            ? data.manageToken!
            : data.manageTokens!.find((item) => item.appointmentId === appt.id)!.manageToken,
        ),
      });
      if (rpcErr) {
        const msg = rpcErr.message || "";
        if (msg === "forbidden")
          throw new Error("You don't have permission to record this transfer.");
        throw rpcErr;
      }
      rpcData = row;
    }
    await supabaseAdmin
      .from("payments")
      .update({ checkout_group_reference: reference })
      .or(
        appts
          .map(
            (_, index) => `reference.eq.${index === 0 ? reference : `${reference}-${index + 1}`}`,
          )
          .join(","),
      );
    r.commitCookies();
    try {
      await sendPaymentEmailsForReference(reference, "bank_transfer_received");
    } catch (error) {
      console.error("[payments] bank transfer receipt email failed:", error);
    }
    noStore();
    return {
      ok: true,
      reference,
      amountKobo,
      bookingReference: appts.map((appt) => appt.booking_reference).join(", "),
      payment: rpcData,
    };
  });

export type PaymentRow = {
  id: string;
  appointmentId: string;
  bookingReference: string | null;
  clientName: string | null;
  clientEmail: string | null;
  provider: "paystack" | "bank_transfer";
  reference: string;
  providerReference: string | null;
  amountKobo: number;
  checkoutGroupReference: string | null;
  checkoutTotalKobo: number;
  checkoutReceipt: PaymentReceipt | null;
  bookingReviewRequired: boolean;
  status: string;
  transferNote: string | null;
  transferReference: string | null;
  receiptPath: string | null;
  failedReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
};

async function loadPaymentsForAdmin(): Promise<PaymentRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, appointment_id, provider, reference, checkout_group_reference, provider_reference, amount_kobo, metadata, status, transfer_note, transfer_reference, receipt_path, failed_reason, created_at, verified_at, appointments(booking_reference, client_name, client_email, status)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  noStore();
  const { isBookingReviewRequired } = await import("@/lib/payments.server");
  const checkoutTotals = new Map<string, number>();
  for (const row of data ?? []) {
    const group = (row.checkout_group_reference as string | null) ?? (row.reference as string);
    checkoutTotals.set(group, (checkoutTotals.get(group) ?? 0) + Number(row.amount_kobo));
  }
  return (data ?? []).map((row): PaymentRow => {
    const appt = row.appointments as {
      booking_reference?: string;
      client_name?: string;
      client_email?: string;
      status?: string;
    } | null;
    return {
      id: row.id as string,
      appointmentId: row.appointment_id as string,
      bookingReference: appt?.booking_reference ?? null,
      clientName: appt?.client_name ?? null,
      clientEmail: appt?.client_email ?? null,
      provider: row.provider as "paystack" | "bank_transfer",
      reference: row.reference as string,
      providerReference: (row.provider_reference as string | null) ?? null,
      amountKobo: Number(row.amount_kobo),
      checkoutGroupReference: (row.checkout_group_reference as string | null) ?? null,
      checkoutTotalKobo:
        checkoutTotals.get(
          (row.checkout_group_reference as string | null) ?? (row.reference as string),
        ) ?? Number(row.amount_kobo),
      checkoutReceipt:
        row.provider === "paystack" && row.status === "succeeded"
          ? readPaymentReceipt(row.metadata)
          : null,
      status: row.status as string,
      transferNote: (row.transfer_note as string | null) ?? null,
      transferReference: (row.transfer_reference as string | null) ?? null,
      receiptPath: (row.receipt_path as string | null) ?? null,
      failedReason: (row.failed_reason as string | null) ?? null,
      createdAt: row.created_at as string,
      verifiedAt: (row.verified_at as string | null) ?? null,
      bookingReviewRequired: isBookingReviewRequired(row.metadata),
    };
  });
}

export const listPaymentsForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentRow[]> => {
    await requireAdmin();
    return loadPaymentsForAdmin();
  },
);

export type PaymentAdminWorkspace = PaymentAdminSetupWorkspace & {
  payments: PaymentRow[];
};

export const getPaymentAdminWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentAdminWorkspace> => {
    await requireAdmin();
    const [settings, packageServices, payments] = await Promise.all([
      loadPaymentAdminData(),
      loadPackageServicesForAdmin(),
      loadPaymentsForAdmin(),
    ]);
    return { settings, packageServices, payments };
  },
);

export const deletePaymentForAdmin = createServerFn({ method: "POST" })
  .validator((d: { paymentId: string }) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error: lookupError } = await supabaseAdmin
      .from("payments")
      .select("status, appointment_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!payment) throw new Error("Payment record not found.");
    if (
      ["pending", "awaiting_confirmation", "succeeded", "refunded"].includes(String(payment.status))
    ) {
      throw new Error(
        "This payment is part of the financial or booking history and cannot be deleted. Use review, cancel, or refund workflows.",
      );
    }
    const { data: deleted, error } = await supabaseAdmin
      .from("payments")
      .delete()
      .eq("id", data.paymentId)
      .in("status", ["initiated", "failed", "cancelled"])
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!deleted) throw new Error("Payment changed and is no longer eligible for deletion.");
    return { ok: true };
  });

const verifyBankInput = z.object({
  paymentId: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const verifyBankTransferPayment = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof verifyBankInput>) => verifyBankInput.parse(d))
  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
      bookingConfirmed: boolean;
      appointmentStatus: string | null;
    }> => {
      const admin = await requireAdmin();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await admin.client.rpc("verify_bank_transfer", {
        p_payment_id: data.paymentId,
        p_approve: data.approve,
        p_note: data.note ?? undefined,
      });
      admin.commitCookies();
      if (error) throw error;

      let appointmentStatus: string | null = null;
      let bookingConfirmed = false;
      if (data.approve) {
        const paymentWithReference = await supabaseAdmin
          .from("payments")
          .select("reference, appointment_id, metadata, appointments(status)")
          .eq("id", data.paymentId)
          .maybeSingle();
        if (paymentWithReference.error) throw paymentWithReference.error;
        const payment = paymentWithReference.data;
        const appointment = payment?.appointments as { status?: string } | null;
        appointmentStatus = appointment?.status ?? null;
        bookingConfirmed =
          ["confirmed", "completed", "no_show"].includes(appointmentStatus ?? "") &&
          !(
            typeof payment?.metadata === "object" &&
            payment.metadata !== null &&
            !Array.isArray(payment.metadata) &&
            payment.metadata.booking_review_required === true
          );
        if (payment?.reference) {
          await syncClientRecordsForSuccessfulPayment(payment.reference as string);
        }
        const appointmentIdForSync = payment?.appointment_id as string | undefined;
        await syncGoogleBeforePaymentEmail(appointmentIdForSync);
        try {
          const { sendPaymentEmail } = await import("@/lib/payment-email.server");
          await sendPaymentEmail({ paymentId: data.paymentId, templateKey: "payment_success" });
        } catch (err) {
          console.error("[payments] payment confirmation email failed:", err);
        }
      }

      return { ok: true, bookingConfirmed, appointmentStatus };
    },
  );

export const recoverPaidBankTransferBooking = createServerFn({ method: "POST" })
  .validator((d: { paymentId: string }) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const rpc = admin.client.rpc.bind(admin.client) as unknown as (
      name: "recover_paid_bank_transfer_booking",
      args: { p_payment_id: string },
    ) => Promise<{
      data: Record<string, unknown>[] | Record<string, unknown> | null;
      error: { message?: string } | null;
    }>;
    const { data: rows, error } = await rpc("recover_paid_bank_transfer_booking", {
      p_payment_id: data.paymentId,
    });
    admin.commitCookies();
    if (error) throw error;
    const row = (Array.isArray(rows) ? rows[0] : rows) as Record<string, unknown> | null;
    if (!row?.id || !row.manage_token) {
      throw new Error("Booking recovery did not return a manage link.");
    }

    const appointmentId = String(row.id);
    await syncGoogleBeforePaymentEmail(appointmentId);
    try {
      const { sendPaymentEmail } = await import("@/lib/payment-email.server");
      await sendPaymentEmail({ paymentId: data.paymentId, templateKey: "payment_success" });
    } catch (err) {
      console.error("[payments] recovered booking email failed:", err);
    }
    const reference = String(row.booking_reference);
    return {
      ok: true as const,
      bookingConfirmed: true as const,
      appointmentStatus: String(row.status),
      manageUrl: canonicalUrl(`/manage/${reference}?token=${String(row.manage_token)}`),
    };
  });

export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .validator((d: { path: string }) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export type PaymentReviewEntry = {
  id: string;
  action: "approve" | "reject";
  previousStatus: string | null;
  newStatus: string;
  note: string | null;
  reviewerId: string | null;
  reviewerEmail: string | null;
  reviewerName: string | null;
  createdAt: string;
};

export const listPaymentReviews = createServerFn({ method: "POST" })
  .validator((d: { paymentId: string }) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PaymentReviewEntry[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("payment_reviews")
      .select(
        "id, action, previous_status, new_status, note, reviewer_id, reviewer_email, reviewer_name, created_at",
      )
      .eq("payment_id", data.paymentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    noStore();
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      action: r.action as "approve" | "reject",
      previousStatus: (r.previous_status as string | null) ?? null,
      newStatus: r.new_status as string,
      note: (r.note as string | null) ?? null,
      reviewerId: (r.reviewer_id as string | null) ?? null,
      reviewerEmail: (r.reviewer_email as string | null) ?? null,
      reviewerName: (r.reviewer_name as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

export type PaymentEventEntry = {
  id: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string;
  providerReference: string | null;
  metadata: Record<string, Json>;
  createdAt: string;
};

type PaymentEventsQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => Promise<{ data: Record<string, unknown>[] | null; error: unknown | null }>;
    };
  };
};

export const listPaymentEvents = createServerFn({ method: "POST" })
  .validator((d: { paymentId: string }) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PaymentEventEntry[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paymentEvents = supabaseAdmin.from(
      "payment_events" as never,
    ) as unknown as PaymentEventsQuery;
    const { data: rows, error } = await paymentEvents
      .select(
        "id, event_type, previous_status, new_status, provider_reference, metadata, created_at",
      )
      .eq("payment_id", data.paymentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    noStore();
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      eventType: r.event_type as string,
      previousStatus: (r.previous_status as string | null) ?? null,
      newStatus: r.new_status as string,
      providerReference: (r.provider_reference as string | null) ?? null,
      metadata: (r.metadata as Record<string, Json> | null) ?? {},
      createdAt: r.created_at as string,
    }));
  });
