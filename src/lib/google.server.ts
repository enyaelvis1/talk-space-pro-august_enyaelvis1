// Server-only Google Calendar / Meet helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "@/lib/payments.server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_API_BASE = "https://www.googleapis.com";
const REQUIRED_GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function normalizeGoogleScopes(scopes: string) {
  const configured = scopes.split(/\s+/).filter(Boolean);
  return [...new Set([...configured, ...REQUIRED_GOOGLE_SCOPES])].join(" ");
}

export type GoogleOAuthSettings = {
  isEnabled: boolean;
  clientId: string | null;
  hasClientSecret: boolean;
  redirectPath: string;
  scopes: string;
  updatedAt: string;
};

export async function loadGoogleOAuthSettings(): Promise<GoogleOAuthSettings> {
  const { data, error } = await supabaseAdmin
    .from("google_oauth_settings")
    .select("is_enabled, client_id, client_secret_ciphertext, redirect_path, scopes, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    isEnabled: Boolean(data?.is_enabled),
    clientId: (data?.client_id as string) ?? null,
    hasClientSecret: Boolean(data?.client_secret_ciphertext),
    redirectPath: (data?.redirect_path as string) ?? "/api/public/google/callback",
    scopes: normalizeGoogleScopes((data?.scopes as string) ?? ""),
    updatedAt: (data?.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function loadGoogleClientSecret(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("google_oauth_settings")
    .select("client_secret_ciphertext")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const ct = data?.client_secret_ciphertext as string | null | undefined;
  return ct ? decryptSecret(ct) : null;
}

export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scopes,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type TokenExchange = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

class GoogleTokenRefreshError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly googleError: string | null,
  ) {
    super(message);
    this.name = "GoogleTokenRefreshError";
  }
}

function parseGoogleTokenError(text: string): string | null {
  try {
    const data = JSON.parse(text) as { error?: unknown };
    return typeof data.error === "string" ? data.error : null;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TokenExchange> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  return JSON.parse(text) as TokenExchange;
}

async function refreshGoogleToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenExchange> {
  const body = new URLSearchParams({
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new GoogleTokenRefreshError(
      `Google token refresh failed (${res.status}): ${text}`,
      res.status,
      parseGoogleTokenError(text),
    );
  }
  return JSON.parse(text) as TokenExchange;
}

export async function fetchGoogleUserinfo(
  accessToken: string,
): Promise<{ email?: string; name?: string }> {
  const res = await fetch(`${GOOGLE_API_BASE}/oauth2/v3/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return (await res.json()) as { email?: string; name?: string };
}

export async function persistTherapistTokens(opts: {
  therapistId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  email?: string;
}) {
  const expiresAt = new Date(Date.now() + Math.max(60, opts.expiresIn - 30) * 1000).toISOString();
  const patch: {
    therapist_id: string;
    access_token_ciphertext: string;
    refresh_token_ciphertext?: string;
    token_expires_at: string;
    last_sync_error: null;
    updated_at: string;
    google_email?: string;
  } = {
    therapist_id: opts.therapistId,
    access_token_ciphertext: encryptSecret(opts.accessToken),
    token_expires_at: expiresAt,
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  };
  if (opts.refreshToken) patch.refresh_token_ciphertext = encryptSecret(opts.refreshToken);
  if (opts.email) patch.google_email = opts.email;
  const { error } = await supabaseAdmin
    .from("therapist_google_connections")
    .upsert(patch, { onConflict: "therapist_id" });
  if (error) throw error;
}

type ConnectionRow = {
  therapist_id: string;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  google_email: string | null;
};

async function loadConnection(therapistId: string): Promise<ConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("therapist_google_connections")
    .select(
      "therapist_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, calendar_id, google_email",
    )
    .eq("therapist_id", therapistId)
    .maybeSingle();
  if (error) throw error;
  return (data as ConnectionRow) ?? null;
}

async function markGoogleConnectionNeedsReconnect(therapistId: string, message: string) {
  await supabaseAdmin
    .from("therapist_google_connections")
    .update({
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      token_expires_at: null,
      sync_channel_id: null,
      sync_resource_id: null,
      sync_expires_at: null,
      last_sync_error: message,
      last_sync_at: new Date().toISOString(),
    })
    .eq("therapist_id", therapistId);
}

async function ensureAccessToken(
  therapistId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const conn = await loadConnection(therapistId);
  if (!conn || !conn.access_token_ciphertext) return null;
  const calendarId = conn.calendar_id || "primary";
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return { accessToken: decryptSecret(conn.access_token_ciphertext), calendarId };
  }
  if (!conn.refresh_token_ciphertext) {
    return { accessToken: decryptSecret(conn.access_token_ciphertext), calendarId };
  }
  const settings = await loadGoogleOAuthSettings();
  const secret = await loadGoogleClientSecret();
  if (!settings.clientId || !secret) throw new Error("Google OAuth is not configured.");
  let refreshed: TokenExchange;
  try {
    refreshed = await refreshGoogleToken({
      clientId: settings.clientId,
      clientSecret: secret,
      refreshToken: decryptSecret(conn.refresh_token_ciphertext),
    });
  } catch (err) {
    if (err instanceof GoogleTokenRefreshError && err.googleError === "invalid_grant") {
      const message =
        "Google access was revoked or expired. Reconnect this therapist's Google account.";
      await markGoogleConnectionNeedsReconnect(therapistId, message);
      throw new Error(message);
    }
    throw err;
  }
  await persistTherapistTokens({
    therapistId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresIn: refreshed.expires_in ?? 3600,
  });
  return { accessToken: refreshed.access_token, calendarId };
}

async function googleFetch(therapistId: string, path: string, init?: RequestInit) {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) throw new Error("Therapist has not connected Google.");
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${creds.accessToken}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${GOOGLE_API_BASE}${path}`, { ...init, headers });
  return res;
}

export type GoogleEventInput = {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  timeZone?: string;
  attendees?: { email: string; displayName?: string }[];
  requestId: string; // for conferenceData idempotency
};

export async function createEventWithMeet(therapistId: string, input: GoogleEventInput) {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) throw new Error("Therapist has not connected Google.");
  const body = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startISO, timeZone: input.timeZone ?? "Africa/Lagos" },
    end: { dateTime: input.endISO, timeZone: input.timeZone ?? "Africa/Lagos" },
    attendees: input.attendees ?? [],
    conferenceData: {
      createRequest: {
        requestId: input.requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  const res = await googleFetch(
    therapistId,
    `/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    { method: "POST", body: JSON.stringify(body) },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Google createEvent failed (${res.status}): ${text}`);
  const event = JSON.parse(text) as {
    id: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  };
  const meetUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  return { eventId: event.id, meetUrl };
}

export async function patchEvent(
  therapistId: string,
  eventId: string,
  input: Partial<GoogleEventInput>,
) {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) throw new Error("Therapist has not connected Google.");
  const body: Record<string, unknown> = {};
  if (input.summary) body.summary = input.summary;
  if (input.description) body.description = input.description;
  if (input.startISO)
    body.start = { dateTime: input.startISO, timeZone: input.timeZone ?? "Africa/Lagos" };
  if (input.endISO)
    body.end = { dateTime: input.endISO, timeZone: input.timeZone ?? "Africa/Lagos" };
  const res = await googleFetch(
    therapistId,
    `/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google patchEvent failed (${res.status}): ${await res.text()}`);
  }
}

export async function deleteEvent(therapistId: string, eventId: string) {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) return;
  const res = await googleFetch(
    therapistId,
    `/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google deleteEvent failed (${res.status}): ${await res.text()}`);
  }
}

export async function listBusyBlocks(
  therapistId: string,
  opts: { fromISO: string; toISO: string; timeZone?: string },
): Promise<{ start: string; end: string }[]> {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) return [];
  const res = await googleFetch(therapistId, "/calendar/v3/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: opts.fromISO,
      timeMax: opts.toISO,
      timeZone: opts.timeZone ?? "Africa/Lagos",
      items: [{ id: creds.calendarId }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (
      res.status === 403 &&
      (text.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || text.includes("insufficientPermissions"))
    ) {
      const message =
        "Google Calendar permission is incomplete. Reconnect this therapist's Google account and approve calendar access.";
      await markGoogleConnectionNeedsReconnect(therapistId, message);
      throw new Error(message);
    }
    throw new Error(`Google freeBusy failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  return data.calendars?.[creds.calendarId]?.busy ?? [];
}

// State signing for OAuth (HMAC over therapist_id + expiry).
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

function stateKey(): Buffer {
  const raw = process.env.EMAIL_SETTINGS_ENC_KEY;
  if (!raw) throw new Error("EMAIL_SETTINGS_ENC_KEY not set.");
  return Buffer.from(raw);
}

export function signGoogleState(therapistId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const expiry = String(Date.now() + 10 * 60 * 1000);
  const payload = `${therapistId}.${expiry}.${nonce}`;
  const sig = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyGoogleState(state: string): { therapistId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [therapistId, expiry, nonce, sig] = parts;
  const payload = `${therapistId}.${expiry}.${nonce}`;
  const expected = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiry) < Date.now()) return null;
  return { therapistId };
}

export function absoluteOrigin(request: Request): string {
  return new URL(request.url).origin;
}

// -------------------------------------------------------------------
// Push notification (watch) helpers
// -------------------------------------------------------------------

export type WatchResult = {
  channelId: string;
  resourceId: string;
  expiresAt: string | null;
};

/**
 * Register a push notification channel for a therapist's primary calendar.
 * Google will POST to `callbackUrl` whenever the calendar changes.
 * Returns the channel + resource IDs so we can stop the channel later.
 */
export async function watchCalendar(
  therapistId: string,
  opts: { callbackUrl: string; token?: string; ttlSeconds?: number },
): Promise<WatchResult> {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) throw new Error("Therapist has not connected Google.");
  const channelId = randomBytes(16).toString("hex");
  const body: Record<string, unknown> = {
    id: channelId,
    type: "web_hook",
    address: opts.callbackUrl,
  };
  if (opts.token) body.token = opts.token;
  if (opts.ttlSeconds && opts.ttlSeconds > 0) {
    body.params = { ttl: String(opts.ttlSeconds) };
  }
  const res = await googleFetch(
    therapistId,
    `/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events/watch`,
    { method: "POST", body: JSON.stringify(body) },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Google watch failed (${res.status}): ${text}`);
  const data = JSON.parse(text) as { id: string; resourceId: string; expiration?: string };
  const expiresAt = data.expiration ? new Date(Number(data.expiration)).toISOString() : null;
  return { channelId: data.id, resourceId: data.resourceId, expiresAt };
}

/** Stop a previously-registered push channel. Best-effort. */
export async function stopWatchCalendar(
  therapistId: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const creds = await ensureAccessToken(therapistId);
  if (!creds) return;
  const res = await googleFetch(therapistId, `/calendar/v3/channels/stop`, {
    method: "POST",
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error(`[google] channels.stop failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Core busy-block sync used by both the admin "Sync now" action and
 * the push webhook. Overwrites google-sourced availability_exceptions
 * for the next 60 days.
 */
export async function syncTherapistBusyBlocks(therapistId: string): Promise<number> {
  const fromISO = new Date().toISOString();
  const toISO = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  let busy: { start: string; end: string }[] = [];
  try {
    busy = await listBusyBlocks(therapistId, { fromISO, toISO });
  } catch (err) {
    await supabaseAdmin
      .from("therapist_google_connections")
      .update({ last_sync_error: (err as Error).message, last_sync_at: new Date().toISOString() })
      .eq("therapist_id", therapistId);
    throw err;
  }
  await supabaseAdmin
    .from("availability_exceptions")
    .delete()
    .eq("therapist_id", therapistId)
    .eq("source", "google")
    .gte("starts_at", fromISO)
    .lte("ends_at", toISO);
  if (busy.length) {
    const rows = busy.map((b, i) => ({
      therapist_id: therapistId,
      kind: "blocked" as const,
      starts_at: b.start,
      ends_at: b.end,
      source: "google",
      external_ref: `gfb-${i}`,
    }));
    const { error } = await supabaseAdmin.from("availability_exceptions").insert(rows);
    if (error) throw error;
  }
  await supabaseAdmin
    .from("therapist_google_connections")
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
    .eq("therapist_id", therapistId);
  return busy.length;
}

/** HMAC token proving a Google push notification originated for this connection. */
export function signPushToken(therapistId: string): string {
  return createHmac("sha256", stateKey()).update(`push:${therapistId}`).digest("base64url");
}

export function verifyPushToken(therapistId: string, token: string): boolean {
  const expected = signPushToken(therapistId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
