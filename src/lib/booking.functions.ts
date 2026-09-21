import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { createRequestSupabase } from "@/lib/supabase-server";
import { requireRequestRole } from "@/lib/server-auth";
import { canonicalUrl } from "@/lib/seo";
import { buildIntakeConsentSnapshot } from "@/lib/intake-consent";
import { getTemplateVersion } from "@/lib/form-templates";
import { guardPublicRequest } from "@/lib/rate-limit.server";
import { fallbackInPersonPriceNgn, isMissingInPersonPriceColumn } from "@/lib/service-pricing";
import { clientPhoneSchema } from "@/lib/client-profile";

async function fireGoogleSync(appointmentId: string) {
  try {
    const { syncAppointmentToGoogle } = await import("@/lib/google.functions");
    await syncAppointmentToGoogle(appointmentId);
  } catch (err) {
    console.error("[booking] google sync failed:", err);
  }
}

async function fireEmail(
  key:
    "booking_confirmation" | "booking_admin_notice" | "reschedule_notice" | "cancellation_notice",
  to: string,
  data: Record<string, unknown>,
  claim?: { appointmentId: string; notificationKey: string; recipientRole: string },
) {
  try {
    const { sendTemplateEmail } = await import("@/lib/email.server");
    const { supabaseAdmin } = claim
      ? await import("@/integrations/supabase/client.server")
      : { supabaseAdmin: null };
    const rpcClient = claim
      ? (supabaseAdmin as unknown as {
          rpc: (
            functionName: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: boolean | null; error: Error | null }>;
        })
      : null;
    if (claim) {
      const { data: claimed, error: claimError } = await rpcClient!.rpc(
        "claim_appointment_notification",
        {
          p_appointment_id: claim.appointmentId,
          p_notification_key: claim.notificationKey,
          p_recipient_role: claim.recipientRole,
        },
      );
      if (claimError) throw claimError;
      if (!claimed) return;
    }
    const result = await sendTemplateEmail(key, to, data);
    if (claim) {
      const { error: finalizeError } = await rpcClient!.rpc("finalize_appointment_notification", {
        p_appointment_id: claim.appointmentId,
        p_notification_key: claim.notificationKey,
        p_recipient_role: claim.recipientRole,
        p_sent: result.sent,
      });
      if (finalizeError) throw finalizeError;
    }
  } catch (err) {
    console.error(`[booking] email send failed (${key}):`, err);
  }
}

async function fireAdminBookingNotice(data: Record<string, unknown>) {
  if (data.status !== "confirmed") return;
  try {
    const { loadEmailSettings, sendTemplateEmail } = await import("@/lib/email.server");
    const settings = await loadEmailSettings();
    const inbox = settings.contactInbox || settings.fromEmail;
    if (!inbox) return;
    await sendTemplateEmail("booking_admin_notice", inbox, data, {
      replyTo: typeof data.clientEmail === "string" ? data.clientEmail : settings.replyTo,
    });
  } catch (err) {
    console.error("[booking] admin email send failed:", err);
  }
}

async function loadAppointmentContext(appointmentId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("appointments")
      .select(
        "booking_reference, client_name, client_email, client_phone, notes, starts_at, session_mode, google_meet_url, manage_token, manage_token_expires_at, manage_token_revoked_at, status, services(name), therapists(full_name, location)",
      )
      .eq("id", appointmentId)
      .maybeSingle();
    if (!data) return null;
    return data as {
      booking_reference: string;
      client_name: string;
      client_email: string;
      client_phone: string | null;
      notes: string | null;
      starts_at: string;
      session_mode: string;
      google_meet_url: string | null;
      manage_token: string | null;
      manage_token_expires_at: string | null;
      manage_token_revoked_at: string | null;
      status: string;
      services: { name?: string } | null;
      therapists: { full_name?: string; location?: string | null } | null;
    };
  } catch (err) {
    console.error("[booking] context lookup failed:", err);
    return null;
  }
}

function buildManageUrl(reference: string, token: string | null | undefined) {
  const base = `/manage/${reference}`;
  return canonicalUrl(token ? `${base}?token=${token}` : base);
}

function isManageTokenActive(row: {
  manage_token?: string | null;
  manage_token_expires_at?: string | null;
  manage_token_revoked_at?: string | null;
  status?: string | null;
}) {
  if (!row.manage_token || row.manage_token_revoked_at) return false;
  if (row.manage_token_expires_at && Date.parse(row.manage_token_expires_at) <= Date.now()) {
    return false;
  }
  return !["cancelled", "completed", "no_show"].includes(String(row.status ?? ""));
}

function buildActiveManageUrl(
  reference: string,
  row: {
    manage_token?: string | null;
    manage_token_expires_at?: string | null;
    manage_token_revoked_at?: string | null;
    status?: string | null;
  },
) {
  return buildManageUrl(reference, isManageTokenActive(row) ? row.manage_token : null);
}

export type BookingSessionMode = "online" | "in_person";

export type BookingService = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sessionsPerPackage: number;
  priceNgn: number | null;
  inPersonPriceNgn: number | null;
};

export type AvailableSlot = {
  therapistId: string;
  therapistName: string | null;
  startsAt: string;
  endsAt: string;
  mode: BookingSessionMode;
};

type AvailableSlotRow = {
  therapist_id: string;
  starts_at: string;
  ends_at: string;
  mode: BookingSessionMode;
};

async function ensureBookingClientProfile(input: {
  userId: string | null | undefined;
  email: string;
  fullName: string;
  phone: string;
  mode: BookingSessionMode;
}) {
  // Reuse an existing profile when available, but do not create one for an
  // unpaid hold. Successful payment reconciliation creates missing profiles.
  if (!input.userId) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export type HeldAppointment = {
  id: string;
  bookingReference: string;
  holdExpiresAt: string;
  startsAt: string;
  endsAt: string;
  therapistId?: string;
  manageToken: string;
  paidWithPackage?: boolean;
  packageId?: string | null;
  packageRemainingSessions?: number | null;
  serverNow: string;
};

export type HeldAppointmentGroup = {
  appointments: HeldAppointment[];
  holdExpiresAt: string;
  bookingReference: string;
  serverNow: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function getConfiguredClient() {
  const requestSupabase = createRequestSupabase(getRequest());
  if (!requestSupabase) throw new Error("Supabase is not configured.");
  return requestSupabase;
}

async function loadBookingCheckoutClock(appointmentIds: string[]) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_booking_checkout_clock", {
      p_appointment_ids: appointmentIds,
    });
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as Array<{
      appointment_id: string;
      checkout_expires_at: string | null;
      server_now: string;
    }>;
    return new Map(rows.map((row) => [row.appointment_id, row]));
  } catch (error) {
    // Older environments can use the hold response until the additive migration is applied.
    console.warn("[booking] database checkout clock unavailable:", error);
    return null;
  }
}

function throwBookingError(error: { code?: string; message?: string }) {
  if (error.message === "slot_unavailable") {
    throw new Error("That slot is no longer available. Please choose another time.");
  }
  if (error.message === "service_unavailable") {
    throw new Error("That service is no longer available for booking.");
  }
  if (error.message === "too_late") {
    throw new Error("Changes to bookings starting within 48 hours must go through our care team.");
  }
  if (error.message === "forbidden") {
    throw new Error("You don't have permission to change this booking.");
  }
  if (error.message === "not_found") {
    throw new Error("We couldn't find that booking.");
  }
  if (error.message === "invalid_state") {
    throw new Error("This booking can't be changed in its current state.");
  }
  if (error.message === "invalid_slot") {
    throw new Error("Please choose an available 15-minute time slot.");
  }
  if (error.message === "package_not_found") {
    throw new Error("That package booking link is invalid.");
  }
  if (error.message === "package_inactive") {
    throw new Error("This package has no remaining active sessions.");
  }
  if (error.message === "package_service_mismatch") {
    throw new Error("This package can only be used for its original service.");
  }
  if (error.message === "package_client_mismatch") {
    throw new Error("Use the client details connected to this package.");
  }
  if (error.message === "package_mode_mismatch") {
    throw new Error("Use the session mode connected to this package.");
  }
  throw new Error(error.message || error.code || "Booking request failed.");
}

export const listBookingServices = createServerFn({ method: "GET" }).handler(async () => {
  const requestSupabase = getConfiguredClient();
  let result = await requestSupabase.client
    .from("services")
    .select(
      "id, code, name, description, duration_minutes, sessions_per_package, price_ngn, in_person_price_ngn",
    )
    .eq("is_active", true)
    .order("display_order");

  if (isMissingInPersonPriceColumn(result.error)) {
    const fallback = await requestSupabase.client
      .from("services")
      .select("id, code, name, description, duration_minutes, sessions_per_package, price_ngn")
      .eq("is_active", true)
      .order("display_order");
    result = fallback.error
      ? fallback
      : { ...fallback, data: fallback.data.map((row) => ({ ...row, in_person_price_ngn: null })) };
  }

  requestSupabase.commitCookies();
  if (result.error) throw result.error;

  return (result.data ?? []).map((service): BookingService => ({
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    durationMinutes: service.duration_minutes,
    sessionsPerPackage: service.sessions_per_package ?? 1,
    priceNgn: service.price_ngn == null ? null : Number(service.price_ngn),
    inPersonPriceNgn:
      "in_person_price_ngn" in service && service.in_person_price_ngn != null
        ? Number(service.in_person_price_ngn)
        : fallbackInPersonPriceNgn(service.code),
  }));
});

export type PackageBookingAccess = {
  id: string;
  packageReference: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  sessionMode: BookingSessionMode | null;
  purchasedSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: string;
  expiresAt: string | null;
};

export const getPackageBookingAccess = createServerFn({ method: "POST" })
  .validator((data: { packageToken: string }) =>
    z.object({ packageToken: z.string().trim().min(16).max(128) }).parse(data),
  )
  .handler(async ({ data }): Promise<PackageBookingAccess | null> => {
    await guardPublicRequest({
      request: getRequest(),
      bucket: "package_token_lookup",
      limit: 20,
      windowSeconds: 15 * 60,
      route: "/book",
      action: "package link",
    });
    const requestSupabase = getConfiguredClient();
    const rpcClient = requestSupabase.client as unknown as {
      rpc: (
        fn: "get_session_package_by_token",
        args: { p_access_token_hash: string },
      ) => Promise<{
        data: Record<string, unknown>[] | Record<string, unknown> | null;
        error: null | { message?: string; code?: string };
      }>;
    };
    const { data: rows, error } = await rpcClient.rpc("get_session_package_by_token", {
      p_access_token_hash: hashToken(data.packageToken),
    });
    requestSupabase.commitCookies();
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    setResponseHeader("Cache-Control", "private, no-store");
    return {
      id: row.id as string,
      packageReference: row.reference as string,
      clientName: row.client_name as string,
      clientEmail: row.client_email as string,
      clientPhone: (row.client_phone as string | null) ?? "",
      serviceId: row.service_id as string,
      serviceName: row.service_name as string,
      sessionMode: (row.session_mode as BookingSessionMode | null) ?? null,
      purchasedSessions: Number(row.purchased_sessions ?? 0),
      usedSessions: Number(row.used_sessions ?? 0),
      remainingSessions: Number(row.remaining_sessions ?? 0),
      status: row.status as string,
      expiresAt: (row.expires_at as string | null) ?? null,
    };
  });

export type BookingPrefill = {
  isAuthenticated: boolean;
  fullName: string;
  email: string;
  phone: string;
};

export const getBookingPrefill = createServerFn({ method: "GET" }).handler(
  async (): Promise<BookingPrefill> => {
    const requestSupabase = getConfiguredClient();
    const {
      data: { user },
    } = await requestSupabase.client.auth.getUser();
    if (!user) {
      requestSupabase.commitCookies();
      return { isAuthenticated: false, fullName: "", email: "", phone: "" };
    }
    const { data: client } = await requestSupabase.client
      .from("clients")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle();
    const { data: profile } = await requestSupabase.client
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    requestSupabase.commitCookies();
    setResponseHeader("Cache-Control", "private, no-store");
    return {
      isAuthenticated: true,
      fullName:
        client?.full_name || profile?.full_name || (user.user_metadata?.full_name as string) || "",
      email: client?.email || user.email || "",
      phone: client?.phone ?? "",
    };
  },
);

const listSlotsInput = z.object({
  serviceId: z.string().uuid(),
  from: z.string().regex(datePattern),
  to: z.string().regex(datePattern),
  mode: z.enum(["online", "in_person"]).optional(),
});

export const listAvailableSlots = createServerFn({ method: "GET" })
  .validator((data: z.infer<typeof listSlotsInput>) => listSlotsInput.parse(data))
  .handler(async ({ data }) => {
    const requestSupabase = getConfiguredClient();
    const { data: slots, error } = await requestSupabase.client.rpc("list_available_slots", {
      p_service_id: data.serviceId,
      p_from: data.from,
      p_to: data.to,
      p_mode: data.mode ?? null,
    });

    requestSupabase.commitCookies();
    if (error) throw error;

    setResponseHeader("Cache-Control", "private, no-store");

    type AvailableSlot = Database["public"]["Functions"]["list_available_slots"]["Returns"][number];
    const availableSlots = (slots ?? []) as AvailableSlot[];

    // Get unique therapist IDs from slots
    const therapistIds = [...new Set(availableSlots.map((slot) => slot.therapist_id))];

    // Fetch therapist names
    let therapistNames = new Map<string, string | null>();
    if (therapistIds.length > 0) {
      const { data: therapists, error: therapistsError } = await requestSupabase.client
        .from("therapists")
        .select("id, full_name")
        .in("id", therapistIds);

      if (therapistsError) {
        console.warn("[booking] failed to fetch therapist names:", therapistsError);
      } else {
        therapistNames = new Map((therapists ?? []).map((t) => [t.id, t.full_name]));
      }
    }

    // Return all slots with therapist names (no deduplication by time)
    return availableSlots
      .filter(
        (slot): slot is AvailableSlot & { mode: "online" | "in_person" } =>
          slot.mode === "online" || slot.mode === "in_person",
      )
      .map((slot) => ({
        therapistId: slot.therapist_id,
        therapistName: therapistNames.get(slot.therapist_id) ?? null,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        mode: slot.mode,
      }));
  });

const holdSlotInput = z.object({
  serviceId: z.string().uuid(),
  therapistId: z.string().uuid(),
  mode: z.enum(["online", "in_person"]),
  startsAt: z.string().datetime({ offset: true }),
  templateKey: z.string().trim().min(1).max(120),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: clientPhoneSchema,
  notes: z.string().trim().max(1000),
  consentAcknowledged: z.literal(true),
  packageToken: z.string().trim().min(16).max(128).optional(),
});

const holdSlotsInput = holdSlotInput
  .omit({ therapistId: true, startsAt: true, packageToken: true })
  .extend({
    slots: z
      .array(
        z.object({
          therapistId: z.string().uuid(),
          startsAt: z.string().datetime({ offset: true }),
        }),
      )
      .min(1)
      .max(10),
  })
  .superRefine((data, ctx) => {
    const uniqueStarts = new Set(
      data.slots.map((slot) => `${slot.therapistId}:${new Date(slot.startsAt).toISOString()}`),
    );
    if (uniqueStarts.size !== data.slots.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots"],
        message: "Choose each therapist and session time only once.",
      });
    }
  });

export const holdSlot = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof holdSlotInput>) => holdSlotInput.parse(data))
  .handler(async ({ data }) => {
    // Abuse guard: booking holds lock real slots, so cap attempts per device.
    await guardPublicRequest({
      request: getRequest(),
      bucket: "booking_hold",
      limit: 10,
      windowSeconds: 15 * 60,
      route: "/book",
      action: "booking",
    });

    const requestSupabase = getConfiguredClient();
    const {
      data: { user },
    } = await requestSupabase.client.auth.getUser();
    const manageToken = randomBytes(32).toString("hex");
    const manageTokenHash = createHash("sha256").update(manageToken).digest("hex");
    const consent = buildIntakeConsentSnapshot("/book");
    const templateVersion = getTemplateVersion(data.templateKey);
    const clientId = await ensureBookingClientProfile({
      userId: user?.id,
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      mode: data.mode,
    });

    const { data: appointment, error } = await requestSupabase.client.rpc("hold_appointment", {
      p_service_id: data.serviceId,
      p_therapist_id: data.therapistId,
      p_session_mode: data.mode,
      p_starts_at: data.startsAt,
      p_client_name: data.fullName,
      p_client_email: data.email,
      p_client_phone: data.phone,
      p_notes: data.notes,
      p_manage_token_hash: manageTokenHash,
      p_client_id: clientId,
    });

    requestSupabase.commitCookies();
    if (error) throwBookingError(error);

    const held = Array.isArray(appointment) ? appointment[0] : appointment;
    if (!held) throw new Error("The booking hold could not be created.");

    // Persist the plaintext manage token so subsequent transactional emails
    // (reminders, reschedule/cancel notices) can include a ready-to-use link.
    void (async () => {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("appointments")
          .update({ manage_token: manageToken })
          .eq("id", held.id);
      } catch (err) {
        console.error("[booking] failed to persist manage_token:", err);
      }

      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("intake_submissions").insert({
          source: "booking",
          template_key: data.templateKey,
          template_version: templateVersion,
          completion_state: "completed",
          consent_acknowledged_at: consent.acknowledgedAt,
          client_id: clientId,
          appointment_id: held.id,
          subject_name: data.fullName,
          subject_email: data.email.toLowerCase(),
          payload: {
            fullName: data.fullName,
            email: data.email.toLowerCase(),
            phone: data.phone,
            serviceId: data.serviceId,
            therapistId: data.therapistId,
            mode: data.mode,
            startsAt: data.startsAt,
            notes: data.notes,
            consent,
          },
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[booking] failed to persist intake snapshot:", err);
      }
    })();

    setResponseHeader("Cache-Control", "private, no-store");
    let packageCredit: {
      package_id: string;
      purchased_sessions: number;
      used_sessions: number;
      remaining_sessions: number;
    } | null = null;
    if (data.packageToken) {
      const rpcClient = requestSupabase.client as unknown as {
        rpc: (
          fn: "consume_session_package_credit",
          args: { p_appointment_id: string; p_access_token_hash: string },
        ) => Promise<{
          data: Record<string, unknown>[] | Record<string, unknown> | null;
          error: null | { message?: string; code?: string };
        }>;
      };
      const { data: creditRows, error: creditError } = await rpcClient.rpc(
        "consume_session_package_credit",
        {
          p_appointment_id: held.id,
          p_access_token_hash: hashToken(data.packageToken),
        },
      );
      if (creditError) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("appointments")
            .update({
              status: "cancelled",
              hold_expires_at: null,
              cancel_reason: "package_credit_failed",
            })
            .eq("id", held.id);
        } catch (err) {
          console.error("[booking] failed to release package hold:", err);
        }
        throwBookingError(creditError);
      }
      const creditRow = (Array.isArray(creditRows) ? creditRows[0] : creditRows) ?? null;
      packageCredit = creditRow
        ? {
            package_id: creditRow.package_id as string,
            purchased_sessions: Number(creditRow.purchased_sessions ?? 0),
            used_sessions: Number(creditRow.used_sessions ?? 0),
            remaining_sessions: Number(creditRow.remaining_sessions ?? 0),
          }
        : null;
    }

    const checkoutClock = packageCredit ? null : await loadBookingCheckoutClock([held.id]);
    const checkoutState = checkoutClock?.get(held.id);
    const heldResult = {
      id: held.id,
      bookingReference: held.booking_reference,
      holdExpiresAt: checkoutState?.checkout_expires_at ?? held.hold_expires_at,
      startsAt: held.starts_at,
      endsAt: held.ends_at,
      manageToken,
      paidWithPackage: Boolean(packageCredit),
      packageId: packageCredit?.package_id ?? null,
      packageRemainingSessions: packageCredit?.remaining_sessions ?? null,
      serverNow: checkoutState?.server_now ?? new Date().toISOString(),
    } satisfies HeldAppointment;

    // Send the final client confirmation only after a package credit is consumed.
    // Card/bank checkout holds wait for the payment success email after commitment.
    void (async () => {
      if (!packageCredit) return;
      if (packageCredit) await fireGoogleSync(held.id);
      const ctx = await loadAppointmentContext(held.id);
      if (!ctx || ctx.status !== "confirmed") return;
      if (packageCredit) {
        await fireEmail("booking_confirmation", data.email, {
          clientName: data.fullName,
          reference: held.booking_reference,
          serviceName: ctx.services?.name ?? "",
          therapistName: ctx.therapists?.full_name ?? "",
          startsAt: held.starts_at,
          mode: data.mode,
          meetingLink: ctx.google_meet_url ?? "",
          location: ctx.therapists?.location ?? "",
          manageUrl: canonicalUrl(`/manage/${held.booking_reference}?token=${manageToken}`),
        });
      }
      await fireAdminBookingNotice({
        clientName: data.fullName,
        clientEmail: data.email,
        clientPhone: data.phone,
        reference: held.booking_reference,
        serviceName: ctx.services?.name ?? "",
        therapistName: ctx.therapists?.full_name ?? "",
        startsAt: held.starts_at,
        mode: data.mode,
        status: ctx.status,
        paymentStatus: packageCredit
          ? `Paid with package (${packageCredit.remaining_sessions} remaining session(s))`
          : "Pending payment/confirmation",
        notes: data.notes,
        location: ctx.therapists?.location ?? "",
        adminUrl: canonicalUrl("/admin/bookings"),
      });
      try {
        const { sendTherapistBookingEmail } = await import("@/lib/therapist-email.server");
        await sendTherapistBookingEmail(held.id as string);
      } catch (err) {
        console.error("[booking] therapist email send failed:", err);
      }
    })();

    return heldResult;
  });

export const holdSlots = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof holdSlotsInput>) => holdSlotsInput.parse(data))
  .handler(async ({ data }): Promise<HeldAppointmentGroup> => {
    await guardPublicRequest({
      request: getRequest(),
      bucket: "booking_hold",
      limit: 10,
      windowSeconds: 15 * 60,
      route: "/book",
      action: "booking",
    });

    const requestSupabase = getConfiguredClient();
    const {
      data: { user },
    } = await requestSupabase.client.auth.getUser();
    const consent = buildIntakeConsentSnapshot("/book");
    const templateVersion = getTemplateVersion(data.templateKey);
    const clientId = await ensureBookingClientProfile({
      userId: user?.id,
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      mode: data.mode,
    });

    const heldAppointments: HeldAppointment[] = [];
    try {
      for (const slot of data.slots) {
        const manageToken = randomBytes(32).toString("hex");
        const manageTokenHash = createHash("sha256").update(manageToken).digest("hex");
        const { data: appointment, error } = await requestSupabase.client.rpc("hold_appointment", {
          p_service_id: data.serviceId,
          p_therapist_id: slot.therapistId,
          p_session_mode: data.mode,
          p_starts_at: slot.startsAt,
          p_client_name: data.fullName,
          p_client_email: data.email,
          p_client_phone: data.phone,
          p_notes: data.notes,
          p_manage_token_hash: manageTokenHash,
          p_client_id: clientId,
        });
        if (error) throwBookingError(error);
        const held = Array.isArray(appointment) ? appointment[0] : appointment;
        if (!held) throw new Error("The booking hold could not be created.");

        heldAppointments.push({
          id: held.id,
          bookingReference: held.booking_reference,
          holdExpiresAt: held.hold_expires_at,
          startsAt: held.starts_at,
          endsAt: held.ends_at,
          therapistId: slot.therapistId,
          manageToken,
          serverNow: new Date().toISOString(),
        });
      }

      requestSupabase.commitCookies();

      void (async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await Promise.all(
            heldAppointments.map((held) =>
              supabaseAdmin
                .from("appointments")
                .update({ manage_token: held.manageToken })
                .eq("id", held.id),
            ),
          );
          await supabaseAdmin.from("intake_submissions").insert(
            heldAppointments.map((held, index) => ({
              source: "booking",
              template_key: data.templateKey,
              template_version: templateVersion,
              completion_state: "completed",
              consent_acknowledged_at: consent.acknowledgedAt,
              client_id: clientId,
              appointment_id: held.id,
              subject_name: data.fullName,
              subject_email: data.email.toLowerCase(),
              payload: {
                fullName: data.fullName,
                email: data.email.toLowerCase(),
                phone: data.phone,
                serviceId: data.serviceId,
                therapistId: data.slots[index].therapistId,
                mode: data.mode,
                startsAt: held.startsAt,
                notes: data.notes,
                consent,
              },
              completed_at: new Date().toISOString(),
            })),
          );
        } catch (err) {
          console.error("[booking] failed to persist multi-slot intake snapshot:", err);
        }

        // Group checkout is still unpaid. Persist intake without notifying staff.
      })();
    } catch (error) {
      if (heldAppointments.length) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("appointments")
            .update({
              status: "cancelled",
              hold_expires_at: null,
              cancel_reason: "multi_slot_hold_failed",
            })
            .in(
              "id",
              heldAppointments.map((held) => held.id),
            );
        } catch (releaseError) {
          console.error("[booking] failed to release partial multi-slot holds:", releaseError);
        }
      }
      requestSupabase.commitCookies();
      throw error;
    }

    const first = heldAppointments[0];
    if (!first) throw new Error("No slots were selected.");
    setResponseHeader("Cache-Control", "private, no-store");
    return {
      appointments: heldAppointments,
      holdExpiresAt: heldAppointments.reduce((earliest, held) =>
        Date.parse(held.holdExpiresAt) < Date.parse(earliest.holdExpiresAt) ? held : earliest,
      ).holdExpiresAt,
      bookingReference: heldAppointments.map((held) => held.bookingReference).join(", "),
      serverNow: new Date().toISOString(),
    };
  });

export type ManagedAppointment = {
  id: string;
  bookingReference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  mode: BookingSessionMode;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceId: string;
  therapistId: string;
  holdExpiresAt: string | null;
  cancelledAt: string | null;
  package: null | {
    id: string;
    purchasedSessions: number;
    usedSessions: number;
    remainingSessions: number;
    status: string;
    bookingUrl: string | null;
  };
};

function hashToken(token: string) {
  const trimmed = token.trim();
  const normalized = trimmed.replace(/[),.;:!?]+$/, "");
  const canonical = /^[a-f0-9]{64}$/i.test(normalized) ? normalized : trimmed;
  return createHash("sha256").update(canonical).digest("hex");
}

const tokenSchema = z.object({ manageToken: z.string().trim().min(16).max(128) });

export const getAppointmentByManageToken = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof tokenSchema>) => tokenSchema.parse(data))
  .handler(async ({ data }): Promise<ManagedAppointment | null> => {
    setResponseHeader("Cache-Control", "private, no-store");
    // Manage tokens are bearer secrets: throttle to stop brute-force guessing.
    await guardPublicRequest({
      request: getRequest(),
      bucket: "manage_token_lookup",
      limit: 20,
      windowSeconds: 15 * 60,
      route: "/manage",
      action: "manage link",
    });

    const requestSupabase = getConfiguredClient();
    const { data: rows, error } = await requestSupabase.client.rpc(
      "get_appointment_by_manage_token",
      { p_manage_token_hash: hashToken(data.manageToken) },
    );
    requestSupabase.commitCookies();

    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    let packageSummary: ManagedAppointment["package"] = null;
    if (row.package_id) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const packageClient = supabaseAdmin as unknown as {
          from: (table: "client_session_packages") => {
            select: (columns: string) => {
              eq: (
                column: string,
                value: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: Record<string, unknown> | null;
                  error: { message?: string } | null;
                }>;
              };
            };
          };
        };
        const { buildPackageBookingUrl } = await import("@/lib/session-packages.server");
        const { data: pkg } = await packageClient
          .from("client_session_packages")
          .select("id, purchased_sessions, used_sessions, status, access_token")
          .eq("id", row.package_id)
          .maybeSingle();
        if (pkg) {
          const purchased = Number(pkg.purchased_sessions ?? 0);
          const used = Number(pkg.used_sessions ?? 0);
          packageSummary = {
            id: pkg.id as string,
            purchasedSessions: purchased,
            usedSessions: used,
            remainingSessions: Math.max(0, purchased - used),
            status: String(pkg.status ?? "active"),
            bookingUrl: buildPackageBookingUrl(pkg.access_token as string | null),
          };
        }
      } catch (err) {
        console.error("[booking] package lookup failed:", err);
      }
    }
    setResponseHeader("Cache-Control", "private, no-store");
    return {
      id: row.id,
      bookingReference: row.booking_reference,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      mode: row.session_mode,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      serviceId: row.service_id,
      therapistId: row.therapist_id,
      holdExpiresAt: row.hold_expires_at,
      cancelledAt: row.cancelled_at,
      package: packageSummary,
    };
  });

export type MyAppointment = ManagedAppointment & {
  serviceName: string | null;
  therapistName: string | null;
};

export const listMyAppointments = createServerFn({ method: "GET" }).handler(async () => {
  const requestSupabase = getConfiguredClient();
  const {
    data: { user },
  } = await requestSupabase.client.auth.getUser();
  if (!user) {
    requestSupabase.commitCookies();
    throw new Error("You must be signed in to view your appointments.");
  }
  const appointmentQuery = requestSupabase.client
    .from("appointments")
    .select(
      "id, booking_reference, status, starts_at, ends_at, session_mode, client_name, client_email, client_phone, service_id, therapist_id, hold_expires_at, cancelled_at, services(name), therapists(full_name)",
    )
    .eq("client_id", user.id)
    .is("archived_at", null)
    .in("status", ["confirmed", "completed", "cancelled", "no_show"])
    .order("starts_at", { ascending: false })
    .limit(100);
  let { data, error } = await appointmentQuery;
  // Older paid bookings may predate client_id backfilling. Fall back to the
  // authenticated email only when the scoped id lookup has no results.
  if (!error && (!data || data.length === 0) && user.email) {
    const fallback = await requestSupabase.client
      .from("appointments")
      .select(
        "id, booking_reference, status, starts_at, ends_at, session_mode, client_name, client_email, client_phone, service_id, therapist_id, hold_expires_at, cancelled_at, services(name), therapists(full_name)",
      )
      .eq("client_email", user.email.trim().toLowerCase())
      .is("archived_at", null)
      .in("status", ["confirmed", "completed", "cancelled", "no_show"])
      .order("starts_at", { ascending: false })
      .limit(100);
    data = fallback.data;
    error = fallback.error;
  }
  requestSupabase.commitCookies();
  if (error) throw error;
  setResponseHeader("Cache-Control", "private, no-store");
  return (data ?? []).map((row: Record<string, unknown>): MyAppointment => ({
    id: row.id as string,
    bookingReference: row.booking_reference as string,
    status: row.status as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    mode: row.session_mode as BookingSessionMode,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string,
    clientPhone: row.client_phone as string,
    serviceId: row.service_id as string,
    therapistId: row.therapist_id as string,
    holdExpiresAt: (row.hold_expires_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    package: null,
    serviceName: (row.services as { name?: string } | null)?.name ?? null,
    therapistName: (row.therapists as { full_name?: string } | null)?.full_name ?? null,
  }));
});

const rescheduleInput = z.object({
  appointmentId: z.string().uuid(),
  newStartsAt: z.string().datetime({ offset: true }),
  manageToken: z.string().trim().min(16).max(128).optional(),
  newTherapistId: z.string().uuid().optional(),
  newMode: z.enum(["online", "in_person"]).optional(),
});

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof rescheduleInput>) => rescheduleInput.parse(data))
  .handler(async ({ data }) => {
    const requestSupabase = getConfiguredClient();
    const { data: rows, error } = await requestSupabase.client.rpc("reschedule_appointment", {
      p_appointment_id: data.appointmentId,
      p_new_starts_at: data.newStartsAt,
      p_manage_token_hash: data.manageToken ? hashToken(data.manageToken) : null,
      p_new_therapist_id: data.newTherapistId ?? null,
      p_new_session_mode: data.newMode ?? null,
    });
    requestSupabase.commitCookies();
    if (error) throwBookingError(error);
    const row = Array.isArray(rows) ? rows[0] : rows;
    const result = {
      id: row.id as string,
      bookingReference: row.booking_reference as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      status: row.status as string,
    };
    void (async () => {
      if (result.status !== "confirmed") return;
      await fireGoogleSync(result.id);
      const ctx = await loadAppointmentContext(result.id);
      if (!ctx?.client_email) return;
      await fireEmail(
        "reschedule_notice",
        ctx.client_email,
        {
          clientName: ctx.client_name,
          reference: result.bookingReference,
          startsAt: result.startsAt,
          serviceName: ctx.services?.name ?? "",
          meetingLink: ctx.google_meet_url ?? "",
          manageUrl: buildActiveManageUrl(result.bookingReference, ctx),
        },
        { appointmentId: result.id, notificationKey: "reschedule_notice", recipientRole: "client" },
      );
    })();
    return result;
  });

const cancelInput = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  manageToken: z.string().trim().min(16).max(128).optional(),
});

export const cancelAppointment = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof cancelInput>) => cancelInput.parse(data))
  .handler(async ({ data }) => {
    const requestSupabase = getConfiguredClient();
    const before = await loadAppointmentContext(data.appointmentId);
    const { data: rows, error } = await requestSupabase.client.rpc("cancel_appointment", {
      p_appointment_id: data.appointmentId,
      p_reason: data.reason ?? null,
      p_manage_token_hash: data.manageToken ? hashToken(data.manageToken) : null,
    });
    requestSupabase.commitCookies();
    if (error) throwBookingError(error);
    const row = Array.isArray(rows) ? rows[0] : rows;
    const result = { id: row.id as string, status: row.status as string };
    void (async () => {
      if (before?.status !== "confirmed") return;
      const ctx = await loadAppointmentContext(result.id);
      if (!ctx?.client_email) return;
      await fireEmail(
        "cancellation_notice",
        ctx.client_email,
        {
          clientName: ctx.client_name,
          reference: ctx.booking_reference,
          startsAt: ctx.starts_at,
          manageUrl: buildActiveManageUrl(ctx.booking_reference, ctx),
        },
        {
          appointmentId: result.id,
          notificationKey: "cancellation_notice",
          recipientRole: "client",
        },
      );
    })();
    if (before?.status === "confirmed") void fireGoogleSync(result.id);
    return result;
  });

const markStatusInput = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["completed", "no_show"]),
});

export const markAppointmentStatus = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof markStatusInput>) => markStatusInput.parse(data))
  .handler(async ({ data }) => {
    const requestSupabase = getConfiguredClient();
    const { data: rows, error } = await requestSupabase.client.rpc("mark_appointment_status", {
      p_appointment_id: data.appointmentId,
      p_new_status: data.status,
    });
    requestSupabase.commitCookies();
    if (error) throwBookingError(error);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { id: row.id as string, status: row.status as string };
  });

export const expireStaleHolds = createServerFn({ method: "POST" }).handler(async () => {
  const requestSupabase = getConfiguredClient();
  const { data, error } = await requestSupabase.client.rpc("expire_stale_holds");
  requestSupabase.commitCookies();
  if (error) throw error;
  return { released: (data as number) ?? 0 };
});

async function requireAdminClient() {
  return (await requireRequestRole("admin")).bag;
}

export type AdminBookingFormData = {
  clients: Array<{ id: string; fullName: string; email: string; phone: string }>;
  services: BookingService[];
  therapists: Array<{ id: string; fullName: string }>;
  packages: Array<{
    id: string;
    reference: string;
    clientName: string;
    clientEmail: string;
    serviceId: string;
    sessionMode: BookingSessionMode | null;
    remainingSessions: number;
  }>;
};

export const getAdminBookingFormData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminBookingFormData> => {
    const bag = await requireAdminClient();
    const [clientsResult, initialServicesResult, therapistsResult, initialPackagesResult] =
      await Promise.all([
        bag.client.from("clients").select("id, full_name, email, phone").order("full_name"),
        bag.client
          .from("services")
          .select(
            "id, code, name, description, duration_minutes, sessions_per_package, price_ngn, in_person_price_ngn",
          )
          .eq("is_active", true)
          .order("display_order"),
        bag.client
          .from("therapists")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
        bag.client
          .from("client_session_packages")
          .select(
            "id, reference, client_name, client_email, service_id, session_mode, purchased_sessions, used_sessions, status, expires_at",
          )
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
    bag.commitCookies();
    if (clientsResult.error) throw clientsResult.error;
    if (therapistsResult.error) throw therapistsResult.error;

    let servicesResult = initialServicesResult;
    if (servicesResult.error && isMissingInPersonPriceColumn(servicesResult.error)) {
      const fallback = await bag.client
        .from("services")
        .select("id, code, name, description, duration_minutes, sessions_per_package, price_ngn")
        .eq("is_active", true)
        .order("display_order");
      servicesResult = fallback.error
        ? fallback
        : {
            ...fallback,
            data: (fallback.data ?? []).map((row) => ({
              ...row,
              in_person_price_ngn: null,
            })),
          };
    }
    if (servicesResult.error) throw servicesResult.error;

    let packagesResult = initialPackagesResult;
    if (packagesResult.error && packagesResult.error.message.includes("reference")) {
      const fallback = await bag.client
        .from("client_session_packages")
        .select(
          "id, client_name, client_email, service_id, session_mode, purchased_sessions, used_sessions, status, expires_at",
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });
      packagesResult = fallback.error
        ? fallback
        : {
            ...fallback,
            data: (fallback.data ?? []).map((row) => ({
              ...row,
              reference: `PKG-${row.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
            })),
          };
    }
    if (packagesResult.error) throw packagesResult.error;

    return {
      clients: (clientsResult.data ?? [])
        .filter((row) => row.email && row.full_name && row.phone)
        .map((row) => ({
          id: row.id,
          fullName: row.full_name ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
        })),
      services: (servicesResult.data ?? []).map((service) => ({
        id: service.id,
        code: service.code,
        name: service.name,
        description: service.description,
        durationMinutes: service.duration_minutes,
        sessionsPerPackage: service.sessions_per_package ?? 1,
        priceNgn: service.price_ngn == null ? null : Number(service.price_ngn),
        inPersonPriceNgn:
          service.in_person_price_ngn == null ? null : Number(service.in_person_price_ngn),
      })),
      therapists: (therapistsResult.data ?? []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
      })),
      packages: (packagesResult.data ?? [])
        .map((row) => ({
          id: row.id,
          reference: row.reference,
          clientName: row.client_name,
          clientEmail: row.client_email,
          serviceId: row.service_id,
          sessionMode: row.session_mode as BookingSessionMode | null,
          remainingSessions: Math.max(row.purchased_sessions - row.used_sessions, 0),
          expiresAt: row.expires_at,
          status: row.status,
        }))
        .filter(
          (row) =>
            row.remainingSessions > 0 && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now()),
        )
        .map(({ expiresAt: _expiresAt, status: _status, ...row }) => row),
    };
  },
);

const adminBookingInput = z.object({
  clientId: z.string().uuid().optional(),
  clientName: z.string().trim().min(2).max(100),
  clientEmail: z.string().trim().email().max(255),
  clientPhone: clientPhoneSchema,
  serviceId: z.string().uuid(),
  therapistId: z.string().uuid(),
  mode: z.enum(["online", "in_person"]),
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(1000).default(""),
  paymentMethod: z.enum(["unpaid", "bank_transfer", "paystack", "package"]),
  paymentStatus: z.enum(["pending", "confirmed"]),
  packageId: z.string().uuid().optional(),
  amountKobo: z.number().int().nonnegative().max(100_000_000),
});

async function findAuthUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

export const createAdminBooking = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof adminBookingInput>) => adminBookingInput.parse(data))
  .handler(async ({ data }) => {
    const bag = await requireAdminClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let clientId = data.clientId ?? null;

    if (!clientId) {
      clientId = await findAuthUserByEmail(data.clientEmail);
      if (!clientId) {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: data.clientEmail.toLowerCase(),
          email_confirm: true,
          user_metadata: { full_name: data.clientName },
        });
        if (error) throw error;
        clientId = created.user.id;
      }
      const { error } = await supabaseAdmin.from("clients").upsert({
        id: clientId,
        full_name: data.clientName,
        email: data.clientEmail.toLowerCase(),
        phone: data.clientPhone,
        record_source: "admin_booking",
      });
      if (error) throw error;
    }

    const manageToken = randomBytes(32).toString("hex");
    const manageTokenHash = createHash("sha256").update(manageToken).digest("hex");
    const rpc = bag.client.rpc.bind(bag.client) as unknown as (
      name: "create_admin_appointment",
      args: Record<string, unknown>,
    ) => Promise<{
      data: Record<string, unknown>[] | Record<string, unknown> | null;
      error: { message?: string } | null;
    }>;
    const { data: rows, error } = await rpc("create_admin_appointment", {
      p_client_id: clientId,
      p_client_name: data.clientName,
      p_client_email: data.clientEmail,
      p_client_phone: data.clientPhone,
      p_service_id: data.serviceId,
      p_therapist_id: data.therapistId,
      p_session_mode: data.mode,
      p_starts_at: data.startsAt,
      p_notes: data.notes,
      p_manage_token_hash: manageTokenHash,
      p_payment_method: data.paymentMethod,
      p_payment_status: data.paymentStatus,
      p_amount_kobo: data.amountKobo,
      p_package_id: data.packageId ?? null,
    });
    bag.commitCookies();
    if (error) {
      const messages: Record<string, string> = {
        slot_unavailable: "That therapist is no longer available at this time.",
        payment_required: "A confirmed booking needs a payment method or package credit.",
        package_inactive: "That package has no remaining active sessions.",
        package_mismatch: "The selected package does not match this client, service, or mode.",
        client_not_found: "Select an existing client or create a new client.",
      };
      throw new Error(messages[error.message ?? ""] ?? error.message ?? "Booking creation failed.");
    }
    const row = (Array.isArray(rows) ? rows[0] : rows) as Record<string, unknown> | null;
    if (!row) throw new Error("Booking creation failed.");
    const appointmentId = String(row.id);

    await supabaseAdmin
      .from("appointments")
      .update({ manage_token: manageToken })
      .eq("id", appointmentId);

    if (row.status === "confirmed") {
      await fireGoogleSync(appointmentId);
      const context = await loadAppointmentContext(appointmentId);
      if (context) {
        const common = {
          clientName: context.client_name,
          clientEmail: context.client_email,
          clientPhone: context.client_phone ?? data.clientPhone,
          reference: context.booking_reference,
          serviceName: context.services?.name ?? "",
          therapistName: context.therapists?.full_name ?? "",
          startsAt: context.starts_at,
          mode: context.session_mode,
          meetingLink: context.google_meet_url ?? "",
          location: context.therapists?.location ?? "",
          manageUrl: canonicalUrl(`/manage/${context.booking_reference}?token=${manageToken}`),
          adminUrl: canonicalUrl("/admin/bookings"),
          status: context.status,
          paymentStatus: data.packageId ? "Paid with package credit" : "Payment confirmed by admin",
          notes: context.notes ?? data.notes,
        };
        await fireEmail("booking_confirmation", context.client_email, common);
        await fireAdminBookingNotice(common);
        try {
          const { sendTherapistBookingEmail } = await import("@/lib/therapist-email.server");
          await sendTherapistBookingEmail(appointmentId);
        } catch (emailError) {
          console.error("[admin booking] therapist email send failed:", emailError);
        }
      }
    }

    return {
      bookingReference: String(row.booking_reference),
      status: String(row.status),
      paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    };
  });

export type UpcomingAppointmentRow = {
  id: string;
  holdExpiresAt: string | null;
  bookingReference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  mode: BookingSessionMode;
  serviceId: string;
  therapistId: string;
  clientName: string;
  clientEmail: string;
  serviceName: string | null;
  therapistName: string | null;
  reminder24hSentAt: string | null;
  reminder1hSentAt: string | null;
  reminder24hStatus: "sent" | "due" | "scheduled" | "missed" | "n/a";
  reminder1hStatus: "sent" | "due" | "scheduled" | "missed" | "n/a";
  hasManageToken: boolean;
  manageTokenExpiresAt: string | null;
  manageTokenRevokedAt: string | null;
  manageTokenRevocationReason: string | null;
  manageTokenStatus: "active" | "expired" | "revoked" | "inactive" | "missing";
  createdAt: string | null;
  googleSyncedAt: string | null;
  googleSyncError: string | null;
  googleMeetUrl: string | null;
  paymentStatus: string | null;
  paymentProvider: string | null;
  paymentNeedsReview: boolean;
  paidAmountKobo: number | null;
  archivedAt: string | null;
  archiveReason: string | null;
};

export type AppointmentTimelineEntry = {
  id: string;
  category: "booking" | "payment" | "form" | "calendar" | "notification";
  title: string;
  detail: string | null;
  tone: "neutral" | "success" | "warning" | "danger";
  createdAt: string;
};

export type AdminAppointmentTimeline = {
  appointmentId: string;
  bookingReference: string;
  entries: AppointmentTimelineEntry[];
};

function classifyReminder(
  sentAt: string | null,
  minutesUntil: number,
  window: { openMin: number; openMax: number },
): UpcomingAppointmentRow["reminder24hStatus"] {
  if (sentAt) return "sent";
  if (minutesUntil <= 0) return "n/a";
  if (minutesUntil > window.openMax) return "scheduled";
  if (minutesUntil >= window.openMin) return "due";
  return "missed";
}

function classifyManageToken(
  row: Record<string, unknown>,
): UpcomingAppointmentRow["manageTokenStatus"] {
  if (!row.manage_token) return "missing";
  if (row.manage_token_revoked_at) return "revoked";
  if (["cancelled", "completed", "no_show"].includes(String(row.status ?? ""))) return "inactive";
  const expiresAt = row.manage_token_expires_at as string | null;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return "expired";
  return "active";
}

function getLagosDayBounds(base = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<
    string,
    string
  >;
  const start = new Date(`${lookup.year}-${lookup.month}-${lookup.day}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function mapAdminAppointmentRow(
  row: Record<string, unknown>,
  now: number,
  win24: { openMin: number; openMax: number },
  win1: { openMin: number; openMax: number },
): UpcomingAppointmentRow {
  const startsAt = row.starts_at as string;
  const minutesUntil = (new Date(startsAt).getTime() - now) / 60000;
  const r24 = (row.reminder_24h_sent_at as string) ?? null;
  const r1 = (row.reminder_1h_sent_at as string) ?? null;
  const payments = Array.isArray(row.payments)
    ? (row.payments as {
        status?: string;
        provider?: string;
        amount_kobo?: number;
        created_at?: string;
        metadata?: Record<string, unknown> | null;
      }[])
    : [];
  const latestPayment = [...payments].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  )[0];
  return {
    id: row.id as string,
    bookingReference: row.booking_reference as string,
    status: row.status as string,
    startsAt,
    holdExpiresAt: (row.hold_expires_at as string | null) ?? null,
    endsAt: row.ends_at as string,
    mode: row.session_mode as BookingSessionMode,
    serviceId: row.service_id as string,
    therapistId: row.therapist_id as string,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string,
    serviceName: (row.services as { name?: string } | null)?.name ?? null,
    therapistName: (row.therapists as { full_name?: string } | null)?.full_name ?? null,
    reminder24hSentAt: r24,
    reminder1hSentAt: r1,
    reminder24hStatus: classifyReminder(r24, minutesUntil, win24),
    reminder1hStatus: classifyReminder(r1, minutesUntil, win1),
    hasManageToken: Boolean(row.manage_token),
    manageTokenExpiresAt: (row.manage_token_expires_at as string | null) ?? null,
    manageTokenRevokedAt: (row.manage_token_revoked_at as string | null) ?? null,
    manageTokenRevocationReason: (row.manage_token_revocation_reason as string | null) ?? null,
    manageTokenStatus: classifyManageToken(row),
    createdAt: (row.created_at as string | null) ?? null,
    googleSyncedAt: (row.google_synced_at as string | null) ?? null,
    googleSyncError: (row.google_sync_error as string | null) ?? null,
    googleMeetUrl: (row.google_meet_url as string | null) ?? null,
    paymentStatus: latestPayment?.status ?? null,
    paymentProvider: latestPayment?.provider ?? null,
    paymentNeedsReview: latestPayment?.metadata?.booking_review_required === true,
    paidAmountKobo: (row.paid_amount_kobo as number | null) ?? latestPayment?.amount_kobo ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    archiveReason: (row.archive_reason as string | null) ?? null,
  };
}

async function loadReminderWindows(
  client: NonNullable<ReturnType<typeof createRequestSupabase>>["client"],
) {
  const { data: settingsRow } = await client
    .from("reminder_settings")
    .select(
      "reminder_24h_open_min_minutes, reminder_24h_open_max_minutes, reminder_1h_open_min_minutes, reminder_1h_open_max_minutes",
    )
    .eq("id", 1)
    .maybeSingle();
  return {
    win24: {
      openMin: (settingsRow?.reminder_24h_open_min_minutes as number) ?? 1380,
      openMax: (settingsRow?.reminder_24h_open_max_minutes as number) ?? 1470,
    },
    win1: {
      openMin: (settingsRow?.reminder_1h_open_min_minutes as number) ?? 30,
      openMax: (settingsRow?.reminder_1h_open_max_minutes as number) ?? 90,
    },
  };
}

export const listAppointmentsForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<UpcomingAppointmentRow[]> => {
    const bag = await requireAdminClient();
    await bag.client.rpc("expire_stale_holds");
    const [windows, appointments] = await Promise.all([
      loadReminderWindows(bag.client),
      bag.client
        .from("appointments")
        .select(
          "id, booking_reference, status, hold_expires_at, starts_at, ends_at, session_mode, service_id, therapist_id, client_name, client_email, manage_token, manage_token_expires_at, manage_token_revoked_at, manage_token_revocation_reason, reminder_24h_sent_at, reminder_1h_sent_at, created_at, google_synced_at, google_sync_error, google_meet_url, paid_amount_kobo, archived_at, archive_reason, services(name), therapists(full_name), payments(status, provider, amount_kobo, created_at, metadata)",
        )
        .is("archived_at", null)
        .order("starts_at", { ascending: false })
        .limit(200),
    ]);
    bag.commitCookies();
    if (appointments.error) throw appointments.error;
    const now = Date.now();
    noStoreLocal();
    return (appointments.data ?? []).map((row: Record<string, unknown>) =>
      mapAdminAppointmentRow(row, now, windows.win24, windows.win1),
    );
  },
);

export const listArchivedAppointmentsForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<UpcomingAppointmentRow[]> => {
    const bag = await requireAdminClient();
    const [windows, appointments] = await Promise.all([
      loadReminderWindows(bag.client),
      bag.client
        .from("appointments")
        .select(
          "id, booking_reference, status, hold_expires_at, starts_at, ends_at, session_mode, service_id, therapist_id, client_name, client_email, manage_token, manage_token_expires_at, manage_token_revoked_at, manage_token_revocation_reason, reminder_24h_sent_at, reminder_1h_sent_at, created_at, google_synced_at, google_sync_error, google_meet_url, paid_amount_kobo, archived_at, archive_reason, services(name), therapists(full_name), payments(status, provider, amount_kobo, created_at, metadata)",
        )
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .limit(100),
    ]);
    bag.commitCookies();
    if (appointments.error) throw appointments.error;
    const now = Date.now();
    noStoreLocal();
    return (appointments.data ?? []).map((row: Record<string, unknown>) =>
      mapAdminAppointmentRow(row, now, windows.win24, windows.win1),
    );
  },
);

type UntypedTimelineQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
    };
  };
};

const appointmentEventLabels: Record<string, string> = {
  booking_created: "Booking created",
  booking_snapshot: "Booking recorded",
  status_changed: "Booking status changed",
  booking_rescheduled: "Booking rescheduled",
  google_synced: "Google Calendar and Meet synchronized",
  google_sync_failed: "Google synchronization failed",
  reminder_sent: "Appointment reminder sent",
};

function appointmentEventDetail(row: Record<string, unknown>) {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  if (row.previous_status || row.new_status) {
    return [row.previous_status, row.new_status].filter(Boolean).join(" → ");
  }
  if (row.event_type === "reminder_sent") return `${metadata.window ?? "Scheduled"} reminder`;
  if (row.event_type === "google_sync_failed") return String(metadata.error ?? "Sync failed");
  if (row.event_type === "booking_rescheduled") {
    return `${String(metadata.previous_starts_at ?? "Previous time")} → ${String(metadata.starts_at ?? "New time")}`;
  }
  return null;
}

export const getAdminAppointmentTimeline = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string }) =>
    z.object({ appointmentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<AdminAppointmentTimeline> => {
    const bag = await requireAdminClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appointment, error: appointmentError } = await bag.client
      .from("appointments")
      .select("id, booking_reference")
      .eq("id", data.appointmentId)
      .maybeSingle();
    bag.commitCookies();
    if (appointmentError) throw appointmentError;
    if (!appointment) throw new Error("Appointment not found.");

    const appointmentEvents = supabaseAdmin.from(
      "appointment_events" as never,
    ) as unknown as UntypedTimelineQuery;
    const [eventResult, paymentResult, formResult] = await Promise.all([
      appointmentEvents
        .select("id, event_type, previous_status, new_status, metadata, created_at")
        .eq("appointment_id", data.appointmentId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("id, provider, reference, status, created_at, verified_at, failed_reason")
        .eq("appointment_id", data.appointmentId),
      supabaseAdmin
        .from("intake_submissions")
        .select("id, template_key, completion_state, created_at, completed_at")
        .eq("appointment_id", data.appointmentId),
    ]);
    if (eventResult.error) throw eventResult.error;
    if (paymentResult.error) throw paymentResult.error;
    if (formResult.error) throw formResult.error;

    const payments = paymentResult.data ?? [];
    let paymentEvents: Record<string, unknown>[] = [];
    if (payments.length) {
      const result = await supabaseAdmin
        .from("payment_events" as never)
        .select("id, payment_id, event_type, previous_status, new_status, metadata, created_at")
        .in(
          "payment_id",
          payments.map((payment) => payment.id),
        );
      if (result.error) throw result.error;
      paymentEvents = (result.data ?? []) as Record<string, unknown>[];
    }

    const paymentsWithEvents = new Set(paymentEvents.map((event) => String(event.payment_id)));

    const entries: AppointmentTimelineEntry[] = [
      ...(eventResult.data ?? []).map((row) => ({
        id: `appointment:${String(row.id)}`,
        category: String(row.event_type).startsWith("google_")
          ? ("calendar" as const)
          : String(row.event_type) === "reminder_sent"
            ? ("notification" as const)
            : ("booking" as const),
        title: appointmentEventLabels[String(row.event_type)] ?? String(row.event_type),
        detail: appointmentEventDetail(row),
        tone:
          row.event_type === "google_sync_failed"
            ? ("danger" as const)
            : row.event_type === "google_synced" || row.event_type === "reminder_sent"
              ? ("success" as const)
              : ("neutral" as const),
        createdAt: String(row.created_at),
      })),
      ...paymentEvents.map((row) => ({
        id: `payment:${String(row.id)}`,
        category: "payment" as const,
        title: "Payment status changed",
        detail: [row.previous_status, row.new_status].filter(Boolean).join(" → "),
        tone:
          row.new_status === "succeeded"
            ? ("success" as const)
            : row.new_status === "failed" || row.new_status === "rejected"
              ? ("danger" as const)
              : ("warning" as const),
        createdAt: String(row.created_at),
      })),
      ...payments
        .filter((payment) => !paymentsWithEvents.has(String(payment.id)))
        .map((payment) => ({
          id: `payment-snapshot:${String(payment.id)}`,
          category: "payment" as const,
          title: "Payment recorded",
          detail: `${String(payment.provider).replaceAll("_", " ")} · ${String(payment.status).replaceAll("_", " ")} · ${String(payment.reference)}`,
          tone:
            payment.status === "succeeded"
              ? ("success" as const)
              : payment.status === "failed"
                ? ("danger" as const)
                : ("warning" as const),
          createdAt: String(payment.verified_at ?? payment.created_at),
        })),
      ...(formResult.data ?? []).map((row) => ({
        id: `form:${String(row.id)}`,
        category: "form" as const,
        title: row.completed_at ? "Intake form completed" : "Intake form started",
        detail: `${String(row.template_key ?? "intake")} · ${String(row.completion_state ?? "draft")}`,
        tone: row.completed_at ? ("success" as const) : ("warning" as const),
        createdAt: String(row.completed_at ?? row.created_at),
      })),
    ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

    noStoreLocal();
    return {
      appointmentId: data.appointmentId,
      bookingReference: String(appointment.booking_reference),
      entries,
    };
  });

async function loadAdminAppointmentWindow(
  bag: Awaited<ReturnType<typeof requireAdminClient>>,
  scope: "today" | "upcoming",
): Promise<UpcomingAppointmentRow[]> {
  const nowIso = new Date().toISOString();
  const horizonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { startIso, endIso } = getLagosDayBounds();
  const { data: settingsRow } = await bag.client
    .from("reminder_settings")
    .select(
      "reminder_24h_open_min_minutes, reminder_24h_open_max_minutes, reminder_1h_open_min_minutes, reminder_1h_open_max_minutes",
    )
    .eq("id", 1)
    .maybeSingle();
  const win24 = {
    openMin: (settingsRow?.reminder_24h_open_min_minutes as number) ?? 1380,
    openMax: (settingsRow?.reminder_24h_open_max_minutes as number) ?? 1470,
  };
  const win1 = {
    openMin: (settingsRow?.reminder_1h_open_min_minutes as number) ?? 30,
    openMax: (settingsRow?.reminder_1h_open_max_minutes as number) ?? 90,
  };
  let query = bag.client
    .from("appointments")
    .select(
      "id, booking_reference, status, hold_expires_at, starts_at, ends_at, session_mode, service_id, therapist_id, client_name, client_email, manage_token, manage_token_expires_at, manage_token_revoked_at, manage_token_revocation_reason, reminder_24h_sent_at, reminder_1h_sent_at, google_synced_at, google_sync_error, google_meet_url, archived_at, archive_reason, services(name), therapists(full_name)",
    )
    .eq("status", "confirmed")
    .is("archived_at", null)
    .order("starts_at", { ascending: true })
    .limit(200);
  query =
    scope === "today"
      ? query.gte("starts_at", startIso).lt("starts_at", endIso)
      : query.gte("starts_at", nowIso).lte("starts_at", horizonIso);
  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).map((row: Record<string, unknown>) =>
    mapAdminAppointmentRow(row, now, win24, win1),
  );
}

export const getAdminAppointmentWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    todayAppointments: UpcomingAppointmentRow[];
    upcomingAppointments: UpcomingAppointmentRow[];
  }> => {
    const bag = await requireAdminClient();
    const [todayAppointments, upcomingAppointments] = await Promise.all([
      loadAdminAppointmentWindow(bag, "today"),
      loadAdminAppointmentWindow(bag, "upcoming"),
    ]);
    bag.commitCookies();
    noStoreLocal();
    return { todayAppointments, upcomingAppointments };
  },
);

export const listUpcomingAppointmentsForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<UpcomingAppointmentRow[]> => {
    const bag = await requireAdminClient();
    const nowIso = new Date().toISOString();
    const horizonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: settingsRow } = await bag.client
      .from("reminder_settings")
      .select(
        "reminder_24h_open_min_minutes, reminder_24h_open_max_minutes, reminder_1h_open_min_minutes, reminder_1h_open_max_minutes",
      )
      .eq("id", 1)
      .maybeSingle();
    const win24 = {
      openMin: (settingsRow?.reminder_24h_open_min_minutes as number) ?? 1380,
      openMax: (settingsRow?.reminder_24h_open_max_minutes as number) ?? 1470,
    };
    const win1 = {
      openMin: (settingsRow?.reminder_1h_open_min_minutes as number) ?? 30,
      openMax: (settingsRow?.reminder_1h_open_max_minutes as number) ?? 90,
    };
    const { data, error } = await bag.client
      .from("appointments")
      .select(
        "id, booking_reference, status, hold_expires_at, starts_at, ends_at, session_mode, service_id, therapist_id, client_name, client_email, manage_token, manage_token_expires_at, manage_token_revoked_at, manage_token_revocation_reason, reminder_24h_sent_at, reminder_1h_sent_at, google_synced_at, google_sync_error, google_meet_url, archived_at, archive_reason, services(name), therapists(full_name)",
      )
      .eq("status", "confirmed")
      .is("archived_at", null)
      .gte("starts_at", nowIso)
      .lte("starts_at", horizonIso)
      .order("starts_at", { ascending: true })
      .limit(200);
    bag.commitCookies();
    if (error) throw error;
    const now = Date.now();
    noStoreLocal();
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapAdminAppointmentRow(row, now, win24, win1),
    );
  },
);

export const listTodayAppointmentsForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<UpcomingAppointmentRow[]> => {
    const bag = await requireAdminClient();
    const { startIso, endIso } = getLagosDayBounds();
    const { data: settingsRow } = await bag.client
      .from("reminder_settings")
      .select(
        "reminder_24h_open_min_minutes, reminder_24h_open_max_minutes, reminder_1h_open_min_minutes, reminder_1h_open_max_minutes",
      )
      .eq("id", 1)
      .maybeSingle();
    const win24 = {
      openMin: (settingsRow?.reminder_24h_open_min_minutes as number) ?? 1380,
      openMax: (settingsRow?.reminder_24h_open_max_minutes as number) ?? 1470,
    };
    const win1 = {
      openMin: (settingsRow?.reminder_1h_open_min_minutes as number) ?? 30,
      openMax: (settingsRow?.reminder_1h_open_max_minutes as number) ?? 90,
    };
    const { data, error } = await bag.client
      .from("appointments")
      .select(
        "id, booking_reference, status, hold_expires_at, starts_at, ends_at, session_mode, service_id, therapist_id, client_name, client_email, manage_token, manage_token_expires_at, manage_token_revoked_at, manage_token_revocation_reason, reminder_24h_sent_at, reminder_1h_sent_at, google_synced_at, google_sync_error, google_meet_url, archived_at, archive_reason, services(name), therapists(full_name)",
      )
      .eq("status", "confirmed")
      .is("archived_at", null)
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .order("starts_at", { ascending: true })
      .limit(200);
    bag.commitCookies();
    if (error) throw error;
    const now = Date.now();
    noStoreLocal();
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapAdminAppointmentRow(row, now, win24, win1),
    );
  },
);

export const archiveAppointmentForAdmin = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; reason?: string }) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdminClient();
    const { data: rows, error } = await bag.client.rpc("archive_appointment_for_admin", {
      p_appointment_id: data.appointmentId,
      p_reason: data.reason?.trim() || "manual_admin_archive",
    } as never);
    bag.commitCookies();
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Appointment not found or already archived.");
    return { ok: true, archivedAt: String(row.archived_at) };
  });

export const restoreAppointmentForAdmin = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string }) =>
    z.object({ appointmentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdminClient();
    const { data: rows, error } = await bag.client.rpc("restore_appointment_for_admin", {
      p_appointment_id: data.appointmentId,
    } as never);
    bag.commitCookies();
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Appointment not found or already active.");
    return { ok: true, restoredId: String(row.id) };
  });

export const cancelAppointmentForAdmin = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; reason?: string }) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdminClient();
    const before = await loadAppointmentContext(data.appointmentId);
    const { data: rows, error } = await bag.client.rpc("cancel_appointment", {
      p_appointment_id: data.appointmentId,
      p_reason: data.reason ?? "manual_admin_cancel_release",
      p_manage_token_hash: null,
    });
    bag.commitCookies();
    if (error) throwBookingError(error);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Appointment not found or already cancelled.");

    if (before?.status === "confirmed") {
      void fireGoogleSync(data.appointmentId);
      if (before.client_email) {
        void fireEmail(
          "cancellation_notice",
          before.client_email,
          {
            clientName: before.client_name,
            reference: before.booking_reference,
            startsAt: before.starts_at,
            manageUrl: buildActiveManageUrl(before.booking_reference, before),
          },
          {
            appointmentId: data.appointmentId,
            notificationKey: "cancellation_notice",
            recipientRole: "client",
          },
        );
      }
    }
    return { id: String(row.id), status: String(row.status) };
  });

export const deleteTemporaryAppointmentsForAdmin = createServerFn({ method: "POST" })
  .validator((data: { appointmentIds: string[]; confirmation: string; reason: string }) =>
    z
      .object({
        appointmentIds: z.array(z.string().uuid()).min(1).max(100),
        confirmation: z.literal("DELETE TEST BOOKINGS"),
        reason: z.string().trim().min(3).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("appointments")
      .select("id, status, manage_token_revocation_reason, payments(status, created_at)")
      .in("id", data.appointmentIds);
    if (candidatesError) throw candidatesError;

    const safeIds = (candidates ?? [])
      .filter((row: Record<string, unknown>) => {
        const status = String(row.status ?? "");
        if (status === "hold") return true;
        if (status === "cancelled") {
          const payments = Array.isArray(row.payments)
            ? (row.payments as { status?: string; created_at?: string }[])
            : [];
          const latestPayment = [...payments].sort((a, b) =>
            String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
          )[0];
          return !["succeeded", "awaiting_confirmation"].includes(
            String(latestPayment?.status ?? ""),
          );
        }
        if (status !== "pending_payment") return false;
        const payments = Array.isArray(row.payments)
          ? (row.payments as { status?: string; created_at?: string }[])
          : [];
        const latestPayment = [...payments].sort((a, b) =>
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
        )[0];
        return !["succeeded", "awaiting_confirmation"].includes(
          String(latestPayment?.status ?? ""),
        );
      })
      .map((row: Record<string, unknown>) => row.id as string);

    if (!safeIds.length) return { deletedCount: 0 };

    let deletedCount = 0;
    for (const appointmentId of safeIds) {
      const { data: deleted, error } = await admin.client.rpc("delete_unpaid_test_appointment", {
        p_appointment_id: appointmentId,
        p_reason: data.reason,
      });
      if (error) throw error;
      if (Array.isArray(deleted) ? deleted.length > 0 : deleted) deletedCount += 1;
    }
    admin.commitCookies();
    return { deletedCount };
  });

export const revokeAppointmentManageToken = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; reason?: string }) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdminClient();
    const { data: rows, error } = await bag.client.rpc("revoke_appointment_manage_token", {
      p_appointment_id: data.appointmentId,
      p_reason: data.reason ?? "manual_admin_revoke",
    });
    bag.commitCookies();
    if (error) throwBookingError(error);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Appointment not found.");
    noStoreLocal();
    return {
      id: row.id,
      manageTokenRevokedAt: row.manage_token_revoked_at,
      manageTokenRevocationReason: row.manage_token_revocation_reason,
    };
  });

function noStoreLocal() {
  setResponseHeader("Cache-Control", "private, no-store");
}

const resendReminderInput = z.object({
  appointmentId: z.string().uuid(),
  reminder: z.enum(["booking_reminder_24h", "booking_reminder_1h"]),
});

const resendConfirmationInput = z.object({ appointmentId: z.string().uuid() });

export const resendBookingConfirmation = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof resendConfirmationInput>) => resendConfirmationInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdminClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email.server");
    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, booking_reference, client_name, client_email, starts_at, session_mode, status, google_meet_url, manage_token, manage_token_expires_at, manage_token_revoked_at, services(name), therapists(full_name, location)",
      )
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Appointment not found.");
    if (row.status !== "confirmed") {
      throw new Error("Confirmation emails can only be resent for confirmed bookings.");
    }

    await fireGoogleSync(row.id as string);
    const result = await sendTemplateEmail("booking_confirmation", row.client_email as string, {
      clientName: row.client_name,
      reference: row.booking_reference,
      serviceName: (row.services as { name?: string } | null)?.name ?? "",
      therapistName: (row.therapists as { full_name?: string } | null)?.full_name ?? "",
      startsAt: row.starts_at,
      mode: row.session_mode,
      meetingLink: row.google_meet_url ?? "",
      location: (row.therapists as { location?: string | null } | null)?.location ?? "",
      manageUrl: buildActiveManageUrl(row.booking_reference as string, row),
    });
    if (!result.sent) {
      throw new Error(result.reason || "The confirmation email could not be sent.");
    }
    return { ok: true, sentAt: new Date().toISOString(), logId: result.logId };
  });

export const resendReminder = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof resendReminderInput>) => resendReminderInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdminClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email.server");
    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, booking_reference, client_name, client_email, starts_at, session_mode, status, manage_token, manage_token_expires_at, manage_token_revoked_at, reminder_24h_sent_at, reminder_1h_sent_at, services(name), therapists(full_name, location)",
      )
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Appointment not found.");

    if (row.status !== "confirmed") {
      throw new Error("Reminders can only be sent for confirmed bookings.");
    }
    const result = await sendTemplateEmail(data.reminder, row.client_email as string, {
      clientName: row.client_name,
      reference: row.booking_reference,
      serviceName: (row.services as { name?: string } | null)?.name ?? "",
      therapistName: (row.therapists as { full_name?: string } | null)?.full_name ?? "",
      startsAt: row.starts_at,
      mode: row.session_mode,
      location: (row.therapists as { location?: string | null } | null)?.location ?? "",
      manageUrl: buildActiveManageUrl(row.booking_reference as string, row),
    });

    if (!result.sent) {
      throw new Error(
        result.reason === "emails_disabled"
          ? "Email sending is disabled in settings."
          : result.reason === "template_disabled"
            ? "This reminder template is disabled."
            : result.reason || "The reminder could not be sent.",
      );
    }

    const stamp = new Date().toISOString();
    const patch =
      data.reminder === "booking_reminder_24h"
        ? { reminder_24h_sent_at: stamp }
        : { reminder_1h_sent_at: stamp };
    await supabaseAdmin.from("appointments").update(patch).eq("id", data.appointmentId);

    return { ok: true, sentAt: stamp };
  });
