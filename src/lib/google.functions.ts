import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireRequestRole } from "@/lib/server-auth";

async function requireAdmin() {
  const context = await requireRequestRole("admin");
  return { userId: context.user.id };
}

function noStore() {
  setResponseHeader("Cache-Control", "private, no-store");
}

const googleSyncInFlight = new Map<string, Promise<void>>();

export type GoogleAdminSettings = {
  isEnabled: boolean;
  clientId: string | null;
  hasClientSecret: boolean;
  redirectPath: string;
  scopes: string;
  redirectUri: string;
  updatedAt: string;
};

async function loadGoogleAdminSettings(): Promise<GoogleAdminSettings> {
  const { loadGoogleOAuthSettings, absoluteOrigin } = await import("@/lib/google.server");
  const s = await loadGoogleOAuthSettings();
  return {
    ...s,
    redirectUri: `${absoluteOrigin(getRequest())}${s.redirectPath}`,
  };
}

export const getGoogleAdminSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleAdminSettings> => {
    await requireAdmin();
    noStore();
    return loadGoogleAdminSettings();
  },
);

const settingsInput = z.object({
  isEnabled: z.boolean(),
  clientId: z.string().trim().max(300).nullable().optional(),
  scopes: z.string().trim().min(1).max(500).optional(),
});

export const updateGoogleAdminSettings = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof settingsInput>) => settingsInput.parse(d))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      is_enabled: boolean;
      client_id: string | null;
      updated_by: string;
      scopes?: string;
    } = {
      is_enabled: data.isEnabled,
      client_id: data.clientId || null,
      updated_by: userId,
    };
    if (data.scopes) patch.scopes = data.scopes;
    const { error } = await supabaseAdmin.from("google_oauth_settings").update(patch).eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

const secretInput = z.object({ value: z.string().trim().min(6).max(512) });

export const setGoogleClientSecretFn = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof secretInput>) => secretInput.parse(d))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { encryptSecret } = await import("@/lib/payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_oauth_settings")
      .update({
        client_secret_ciphertext: encryptSecret(data.value),
        updated_by: userId,
      })
      .eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

export const clearGoogleClientSecret = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("google_oauth_settings")
    .update({ client_secret_ciphertext: null, updated_by: userId })
    .eq("id", 1);
  if (error) throw error;
  return { ok: true };
});

export type TherapistConnectionRow = {
  therapistId: string;
  therapistName: string;
  connected: boolean;
  googleEmail: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  watchExpiresAt: string | null;
  failingAppointmentCount: number;
};

async function loadTherapistConnections(): Promise<TherapistConnectionRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: therapists, error } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  if (error) throw error;
  const { data: conns } = await supabaseAdmin
    .from("therapist_google_connections")
    .select(
      "therapist_id, google_email, token_expires_at, last_sync_at, last_sync_error, sync_expires_at",
    );
  const { data: activeConns } = await supabaseAdmin
    .from("therapist_google_connections")
    .select("therapist_id")
    .not("access_token_ciphertext", "is", null);
  const connectedIds = new Set((activeConns ?? []).map((row) => row.therapist_id as string));
  const map = new Map<
    string,
    {
      google_email: string | null;
      token_expires_at: string | null;
      last_sync_at: string | null;
      last_sync_error: string | null;
      sync_expires_at: string | null;
    }
  >();
  for (const c of conns ?? []) map.set(c.therapist_id as string, c as never);

  // Count appointments in a failing sync state per therapist.
  const { data: failing } = await supabaseAdmin
    .from("appointments")
    .select("therapist_id")
    .not("google_sync_error", "is", null);
  const failCounts = new Map<string, number>();
  for (const row of failing ?? []) {
    const id = row.therapist_id as string;
    failCounts.set(id, (failCounts.get(id) ?? 0) + 1);
  }

  return (therapists ?? []).map((t) => {
    const c = map.get(t.id as string);
    return {
      therapistId: t.id as string,
      therapistName: (t.full_name as string) ?? "",
      connected: connectedIds.has(t.id as string),
      googleEmail: c?.google_email ?? null,
      tokenExpiresAt: c?.token_expires_at ?? null,
      lastSyncAt: c?.last_sync_at ?? null,
      lastSyncError: c?.last_sync_error ?? null,
      watchExpiresAt: c?.sync_expires_at ?? null,
      failingAppointmentCount: failCounts.get(t.id as string) ?? 0,
    };
  });
}

export const listTherapistConnections = createServerFn({ method: "GET" }).handler(
  async (): Promise<TherapistConnectionRow[]> => {
    await requireAdmin();
    noStore();
    return loadTherapistConnections();
  },
);

export type GoogleAdminWorkspace = {
  settings: GoogleAdminSettings;
  connections: TherapistConnectionRow[];
};

export const getGoogleAdminWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleAdminWorkspace> => {
    await requireAdmin();
    const [settings, connections] = await Promise.all([
      loadGoogleAdminSettings(),
      loadTherapistConnections(),
    ]);
    noStore();
    return { settings, connections };
  },
);

export type GoogleSyncActivityRow = {
  appointmentId: string;
  bookingReference: string;
  clientName: string;
  startsAt: string;
  status: string;
  googleEventId: string | null;
  googleMeetUrl: string | null;
  googleSyncedAt: string | null;
  googleSyncError: string | null;
};

const activityInput = z.object({
  therapistId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(15).optional(),
});

export const listGoogleSyncActivity = createServerFn({ method: "GET" })
  .validator((d: z.infer<typeof activityInput>) => activityInput.parse(d))
  .handler(async ({ data }): Promise<GoogleSyncActivityRow[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, booking_reference, client_name, starts_at, status, google_event_id, google_meet_url, google_synced_at, google_sync_error",
      )
      .eq("therapist_id", data.therapistId)
      .or("google_synced_at.not.is.null,google_sync_error.not.is.null")
      .order("google_synced_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 15);
    if (error) throw error;
    noStore();
    return (rows ?? []).map((r) => ({
      appointmentId: r.id as string,
      bookingReference: (r.booking_reference as string) ?? "",
      clientName: (r.client_name as string) ?? "",
      startsAt: r.starts_at as string,
      status: r.status as string,
      googleEventId: (r.google_event_id as string | null) ?? null,
      googleMeetUrl: (r.google_meet_url as string | null) ?? null,
      googleSyncedAt: (r.google_synced_at as string | null) ?? null,
      googleSyncError: (r.google_sync_error as string | null) ?? null,
    }));
  });

const retryInput = z.object({ appointmentId: z.string().uuid() });

export const retryAppointmentSync = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof retryInput>) => retryInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await syncAppointmentToGoogle(data.appointmentId);
    // Report the post-retry state so the UI can show success/error.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("appointments")
      .select("google_sync_error, google_synced_at, google_event_id, google_meet_url")
      .eq("id", data.appointmentId)
      .maybeSingle();
    return {
      ok: !row?.google_sync_error,
      error: (row?.google_sync_error as string | null) ?? null,
      syncedAt: (row?.google_synced_at as string | null) ?? null,
      eventId: (row?.google_event_id as string | null) ?? null,
      meetUrl: (row?.google_meet_url as string | null) ?? null,
    };
  });

const therapistIdInput = z.object({ therapistId: z.string().uuid() });

export const startGoogleConnect = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof therapistIdInput>) => therapistIdInput.parse(d))
  .handler(async ({ data }): Promise<{ authorizationUrl: string }> => {
    await requireAdmin();
    const {
      loadGoogleOAuthSettings,
      loadGoogleClientSecret,
      buildGoogleAuthUrl,
      signGoogleState,
      absoluteOrigin,
    } = await import("@/lib/google.server");
    const s = await loadGoogleOAuthSettings();
    if (!s.isEnabled) throw new Error("Google integration is not enabled.");
    if (!s.clientId) throw new Error("Google Client ID is missing.");
    const secret = await loadGoogleClientSecret();
    if (!secret) throw new Error("Google Client Secret is missing.");
    const redirectUri = `${absoluteOrigin(getRequest())}${s.redirectPath}`;
    const state = signGoogleState(data.therapistId);
    const url = buildGoogleAuthUrl({ clientId: s.clientId, redirectUri, scopes: s.scopes, state });
    return { authorizationUrl: url };
  });

export const disconnectTherapistGoogle = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof therapistIdInput>) => therapistIdInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("therapist_google_connections")
      .select("sync_channel_id, sync_resource_id")
      .eq("therapist_id", data.therapistId)
      .maybeSingle();
    if (existing?.sync_channel_id && existing?.sync_resource_id) {
      try {
        const { stopWatchCalendar } = await import("@/lib/google.server");
        await stopWatchCalendar(
          data.therapistId,
          existing.sync_channel_id as string,
          existing.sync_resource_id as string,
        );
      } catch (err) {
        console.warn("[google] stop channel on disconnect failed:", err);
      }
    }
    const { error } = await supabaseAdmin
      .from("therapist_google_connections")
      .delete()
      .eq("therapist_id", data.therapistId);
    if (error) throw error;
    return { ok: true };
  });

export const syncTherapistBusy = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof therapistIdInput>) => therapistIdInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { syncTherapistBusyBlocks } = await import("@/lib/google.server");
    const count = await syncTherapistBusyBlocks(data.therapistId);
    return { ok: true, count };
  });

/**
 * Register a Google push-notification channel so the app is notified within
 * seconds whenever the therapist's calendar changes. Channels expire after
 * ~7 days (Google enforces the max TTL); the reminder cron re-registers.
 */
export const startTherapistWatch = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof therapistIdInput>) => therapistIdInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { watchCalendar, stopWatchCalendar, signPushToken, absoluteOrigin } =
      await import("@/lib/google.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Stop any prior channel before opening a new one.
    const { data: existing } = await supabaseAdmin
      .from("therapist_google_connections")
      .select("sync_channel_id, sync_resource_id")
      .eq("therapist_id", data.therapistId)
      .maybeSingle();
    if (existing?.sync_channel_id && existing?.sync_resource_id) {
      try {
        await stopWatchCalendar(
          data.therapistId,
          existing.sync_channel_id as string,
          existing.sync_resource_id as string,
        );
      } catch (err) {
        console.warn("[google] stop previous channel failed:", err);
      }
    }

    const callbackUrl = `${absoluteOrigin(getRequest())}/api/public/google/push`;
    const token = signPushToken(data.therapistId);
    const result = await watchCalendar(data.therapistId, {
      callbackUrl,
      token,
      ttlSeconds: 7 * 24 * 3600,
    });
    const { error } = await supabaseAdmin
      .from("therapist_google_connections")
      .update({
        sync_channel_id: result.channelId,
        sync_resource_id: result.resourceId,
        sync_expires_at: result.expiresAt,
      })
      .eq("therapist_id", data.therapistId);
    if (error) throw error;
    return { ok: true, expiresAt: result.expiresAt };
  });

export const stopTherapistWatch = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof therapistIdInput>) => therapistIdInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("therapist_google_connections")
      .select("sync_channel_id, sync_resource_id")
      .eq("therapist_id", data.therapistId)
      .maybeSingle();
    if (conn?.sync_channel_id && conn?.sync_resource_id) {
      const { stopWatchCalendar } = await import("@/lib/google.server");
      await stopWatchCalendar(
        data.therapistId,
        conn.sync_channel_id as string,
        conn.sync_resource_id as string,
      );
    }
    await supabaseAdmin
      .from("therapist_google_connections")
      .update({ sync_channel_id: null, sync_resource_id: null, sync_expires_at: null })
      .eq("therapist_id", data.therapistId);
    return { ok: true };
  });

/**
 * Idempotent sync for an appointment. Called from booking hooks.
 * - If appointment is confirmed and no google_event_id → create.
 * - If confirmed and google_event_id exists → patch (times may have changed).
 * - If cancelled/completed/no_show and google_event_id exists → delete.
 * Best-effort: failures are stored on google_sync_error and swallowed.
 */
export async function syncAppointmentToGoogle(appointmentId: string): Promise<void> {
  const existing = googleSyncInFlight.get(appointmentId);
  if (existing) return existing;
  const work = syncAppointmentToGoogleInternal(appointmentId);
  googleSyncInFlight.set(appointmentId, work);
  try {
    await work;
  } finally {
    if (googleSyncInFlight.get(appointmentId) === work) googleSyncInFlight.delete(appointmentId);
  }
}

async function syncAppointmentToGoogleInternal(appointmentId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, status, therapist_id, starts_at, ends_at, session_mode, client_email, client_name, booking_reference, google_event_id, services(name)",
      )
      .eq("id", appointmentId)
      .maybeSingle();
    if (error || !appt) return;
    const { loadGoogleOAuthSettings } = await import("@/lib/google.server");
    const s = await loadGoogleOAuthSettings();
    if (!s.isEnabled) return;
    const { data: conn } = await supabaseAdmin
      .from("therapist_google_connections")
      .select("therapist_id")
      .eq("therapist_id", appt.therapist_id)
      .not("access_token_ciphertext", "is", null)
      .maybeSingle();
    if (!conn) return;

    const svcName = (appt.services as { name?: string } | null)?.name ?? "Talk Space session";
    const summary = `Talk Space — ${svcName}`;
    const description = `Booking reference: ${appt.booking_reference}\nClient: ${appt.client_name}\nMode: ${appt.session_mode}`;
    const attendees = appt.client_email
      ? [{ email: appt.client_email as string, displayName: appt.client_name as string }]
      : [];
    const status = appt.status as string;

    if (status === "confirmed") {
      const { createEventWithMeet, patchEvent } = await import("@/lib/google.server");
      if (appt.google_event_id) {
        await patchEvent(appt.therapist_id as string, appt.google_event_id as string, {
          summary,
          description,
          startISO: appt.starts_at as string,
          endISO: appt.ends_at as string,
          requestId: appt.booking_reference as string,
        });
        await supabaseAdmin
          .from("appointments")
          .update({
            google_synced_at: new Date().toISOString(),
            google_sync_error: null,
          })
          .eq("id", appointmentId);
      } else {
        const created = await createEventWithMeet(appt.therapist_id as string, {
          summary,
          description,
          startISO: appt.starts_at as string,
          endISO: appt.ends_at as string,
          attendees,
          requestId: appt.booking_reference as string,
        });
        await supabaseAdmin
          .from("appointments")
          .update({
            google_event_id: created.eventId,
            google_meet_url: created.meetUrl,
            google_synced_at: new Date().toISOString(),
            google_sync_error: null,
          })
          .eq("id", appointmentId);
      }
    } else if (["cancelled", "completed", "no_show"].includes(status) && appt.google_event_id) {
      const { deleteEvent } = await import("@/lib/google.server");
      await deleteEvent(appt.therapist_id as string, appt.google_event_id as string);
      await supabaseAdmin
        .from("appointments")
        .update({
          google_event_id: null,
          google_meet_url: null,
          google_synced_at: new Date().toISOString(),
          google_sync_error: null,
        })
        .eq("id", appointmentId);
    }
  } catch (err) {
    console.error("[google] sync appointment failed:", err);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("appointments")
        .update({
          google_sync_error: (err as Error).message,
          google_synced_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);
    } catch {
      /* ignore */
    }
  }
}
