import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireRequestRole } from "@/lib/server-auth";

function noStore() {
  setResponseHeader("Cache-Control", "private, no-store");
}

type TherapistContext = {
  userId: string;
  therapistId: string;
  fullName: string;
  roleTitle: string;
  imageUrl: string | null;
};

async function requireTherapist(): Promise<TherapistContext> {
  const context = await requireRequestRole("therapist");
  const { user } = context;

  const { data: therapist, error } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, role_title, image_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!therapist) {
    throw new Error("No therapist profile is linked to this account.");
  }

  return {
    userId: user.id,
    therapistId: therapist.id as string,
    fullName: therapist.full_name as string,
    roleTitle: therapist.role_title as string,
    imageUrl: (therapist.image_url as string | null) ?? null,
  };
}

export const disconnectTherapistGoogle = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const ctx = await requireTherapist();
    const { data: existing } = await supabaseAdmin
      .from("therapist_google_connections")
      .select("sync_channel_id, sync_resource_id")
      .eq("therapist_id", ctx.therapistId)
      .maybeSingle();
    if (existing?.sync_channel_id && existing?.sync_resource_id) {
      try {
        const { stopWatchCalendar } = await import("@/lib/google.server");
        await stopWatchCalendar(
          ctx.therapistId,
          existing.sync_channel_id as string,
          existing.sync_resource_id as string,
        );
      } catch (err) {
        console.warn("[google] stop channel on therapist disconnect failed:", err);
      }
    }
    const { error } = await supabaseAdmin
      .from("therapist_google_connections")
      .delete()
      .eq("therapist_id", ctx.therapistId);
    if (error) throw error;
    return { ok: true };
  },
);

export type TherapistDashboardAppointment = {
  id: string;
  bookingReference: string;
  startsAt: string;
  endsAt: string;
  status: string;
  mode: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  notes: string | null;
  serviceName: string | null;
  googleMeetUrl: string | null;
  googleSyncError: string | null;
};

export type TherapistCalendarStatus = {
  connected: boolean;
  googleEmail: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

export type TherapistDashboardData = {
  therapist: {
    id: string;
    fullName: string;
    roleTitle: string;
    imageUrl: string | null;
  };
  calendar: TherapistCalendarStatus;
  today: TherapistDashboardAppointment[];
  upcoming: TherapistDashboardAppointment[];
};

function lagosDayBounds(base = new Date()) {
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

function mapAppointment(row: Record<string, unknown>): TherapistDashboardAppointment {
  return {
    id: row.id as string,
    bookingReference: row.booking_reference as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    status: row.status as string,
    mode: row.session_mode as string,
    clientName: row.client_name as string,
    clientEmail: (row.client_email as string | null) ?? null,
    clientPhone: (row.client_phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    serviceName: (row.services as { name?: string } | null)?.name ?? null,
    googleMeetUrl: (row.google_meet_url as string | null) ?? null,
    googleSyncError: (row.google_sync_error as string | null) ?? null,
  };
}

async function loadCalendarStatus(therapistId: string): Promise<TherapistCalendarStatus> {
  const { data: connection, error } = await supabaseAdmin
    .from("therapist_google_connections")
    .select("google_email, token_expires_at, last_sync_at, last_sync_error")
    .eq("therapist_id", therapistId)
    .maybeSingle();
  if (error) throw error;

  const { data: active } = await supabaseAdmin
    .from("therapist_google_connections")
    .select("therapist_id")
    .eq("therapist_id", therapistId)
    .not("access_token_ciphertext", "is", null)
    .maybeSingle();

  return {
    connected: Boolean(active),
    googleEmail: (connection?.google_email as string | null) ?? null,
    tokenExpiresAt: (connection?.token_expires_at as string | null) ?? null,
    lastSyncAt: (connection?.last_sync_at as string | null) ?? null,
    lastSyncError: (connection?.last_sync_error as string | null) ?? null,
  };
}

export const getTherapistDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<TherapistDashboardData> => {
    const ctx = await requireTherapist();
    const nowIso = new Date().toISOString();
    const horizonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { startIso, endIso } = lagosDayBounds();

    const [calendar, todayResult, upcomingResult] = await Promise.all([
      loadCalendarStatus(ctx.therapistId),
      supabaseAdmin
        .from("appointments")
        .select(
          "id, booking_reference, status, starts_at, ends_at, session_mode, client_name, client_email, client_phone, notes, google_meet_url, google_sync_error, services(name)",
        )
        .eq("therapist_id", ctx.therapistId)
        .is("archived_at", null)
        .in("status", ["confirmed", "completed", "cancelled", "no_show"])
        .gte("starts_at", startIso)
        .lt("starts_at", endIso)
        .order("starts_at", { ascending: true })
        .limit(25),
      supabaseAdmin
        .from("appointments")
        .select(
          "id, booking_reference, status, starts_at, ends_at, session_mode, client_name, client_email, client_phone, notes, google_meet_url, google_sync_error, services(name)",
        )
        .eq("therapist_id", ctx.therapistId)
        .is("archived_at", null)
        .eq("status", "confirmed")
        .gte("starts_at", nowIso)
        .lte("starts_at", horizonIso)
        .order("starts_at", { ascending: true })
        .limit(50),
    ]);

    if (todayResult.error) throw todayResult.error;
    if (upcomingResult.error) throw upcomingResult.error;

    noStore();
    return {
      therapist: {
        id: ctx.therapistId,
        fullName: ctx.fullName,
        roleTitle: ctx.roleTitle,
        imageUrl: ctx.imageUrl,
      },
      calendar,
      today: (todayResult.data ?? []).map((row) => mapAppointment(row as Record<string, unknown>)),
      upcoming: (upcomingResult.data ?? []).map((row) =>
        mapAppointment(row as Record<string, unknown>),
      ),
    };
  },
);

export const startTherapistGoogleConnect = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ authorizationUrl: string }> => {
    const ctx = await requireTherapist();
    const {
      absoluteOrigin,
      buildGoogleAuthUrl,
      loadGoogleClientSecret,
      loadGoogleOAuthSettings,
      signGoogleState,
    } = await import("@/lib/google.server");
    const settings = await loadGoogleOAuthSettings();
    if (!settings.isEnabled) throw new Error("Google integration is not enabled.");
    if (!settings.clientId) throw new Error("Google Client ID is missing.");
    const secret = await loadGoogleClientSecret();
    if (!secret) throw new Error("Google Client Secret is missing.");
    const redirectUri = `${absoluteOrigin(getRequest())}${settings.redirectPath}`;
    const state = signGoogleState(ctx.therapistId);
    return {
      authorizationUrl: buildGoogleAuthUrl({
        clientId: settings.clientId,
        redirectUri,
        scopes: settings.scopes,
        state,
      }),
    };
  },
);
