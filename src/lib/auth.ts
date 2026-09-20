import { redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { hasProgressAccess } from "@/lib/progress-access";

export type AppRole = "admin" | "staff" | "client" | "therapist";

export const SESSION_MAX_LIFETIME_MS = 60 * 60 * 1000;
export const SESSION_WARNING_WINDOW_MS = 5 * 60 * 1000;

export function getSessionExpiryState(session: Session | null | undefined) {
  if (!session) {
    return { expiresAtMs: null, expiresInMs: null, isWarning: false, isExpired: true };
  }

  const expiresAtMs = Number(session.expires_at)
    ? Number(session.expires_at) * 1000
    : Date.parse(session.user.last_sign_in_at ?? "") + SESSION_MAX_LIFETIME_MS;

  const expiresInMs = expiresAtMs - Date.now();
  const isExpired =
    !Number.isFinite(expiresInMs) ||
    expiresInMs <= 0 ||
    Date.now() - Date.parse(session.user.last_sign_in_at ?? "") > SESSION_MAX_LIFETIME_MS;
  const isWarning = !isExpired && expiresInMs <= SESSION_WARNING_WINDOW_MS;

  return {
    expiresAtMs,
    expiresInMs,
    isWarning,
    isExpired,
  };
}

export async function getBrowserSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session;
}

function isSessionExpired(session: Session | null | undefined): boolean {
  if (!session) return true;

  const expiresAtSeconds = Number(session.expires_at);
  if (Number.isFinite(expiresAtSeconds)) {
    const expiresAtMs = expiresAtSeconds * 1000;
    if (expiresAtMs <= Date.now() + 5000) return true;
  }

  const createdAtMs = Date.parse(session.user.last_sign_in_at ?? "");
  if (Number.isFinite(createdAtMs)) {
    const sessionAgeMs = Date.now() - createdAtMs;
    if (sessionAgeMs > SESSION_MAX_LIFETIME_MS) return true;
  }

  return false;
}

export async function getVerifiedBrowserSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  if (isSessionExpired(session)) {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // ignore sign-out failures during a stale session reset
    }
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && !userData.user) {
    return session;
  }

  if (!userData.user) {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // ignore sign-out failures during a stale session reset
    }
    return null;
  }

  return session;
}

export async function hasBrowserRole(role: AppRole): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const session = await getVerifiedBrowserSession();
  if (!supabase || !session) return false;

  const { data, error } = await supabase.rpc("has_role", {
    _user_id: session.user.id,
    _role: role,
  });

  return !error && data === true;
}

export async function requireBrowserSession(location: string) {
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured) {
    throw redirect({ href: "/login?error=configuration" });
  }
  if (await getVerifiedBrowserSession()) return;

  throw redirect({
    href: `/login?error=session_expired&redirect=${encodeURIComponent(getSafeRedirect(location))}`,
  });
}

export async function requireBrowserAdmin(location: string) {
  if (typeof window === "undefined" || !isSupabaseConfigured) return;
  const session = await getVerifiedBrowserSession();
  if (!session) {
    throw redirect({
      href: `/login?error=session_expired&redirect=${encodeURIComponent(getSafeRedirect(location))}`,
    });
  }
  if (await hasBrowserRole("admin")) return;

  throw redirect({ href: "/account?error=forbidden" });
}

export async function requireBrowserProgressAccess(location: string) {
  await requireBrowserAdmin(location);
  const session = await getVerifiedBrowserSession();
  if (session && hasProgressAccess("admin", session.user.email)) return;

  throw redirect({ href: "/account?error=forbidden" });
}

export function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/account";
  return value.startsWith("//") ? "/account" : value;
}
