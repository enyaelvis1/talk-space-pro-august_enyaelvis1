import type { Session } from "@supabase/supabase-js";

import {
  getSessionExpiryState,
  getVerifiedBrowserSession,
  hasBrowserRoleForSession,
} from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type BrowserAuthSnapshot = {
  status: "loading" | "ready" | "error";
  session: Session | null;
  isAdmin: boolean;
  isTherapist: boolean;
  sessionExpiryWarning: string | null;
  checkedAt: number;
};

const initialSnapshot: BrowserAuthSnapshot = {
  status: "loading",
  session: null,
  isAdmin: false,
  isTherapist: false,
  sessionExpiryWarning: null,
  checkedAt: 0,
};

let snapshot = initialSnapshot;
let started = false;
let refreshPromise: Promise<void> | null = null;
let lastRefreshAt = 0;
let expiryTimer: number | undefined;
const listeners = new Set<() => void>();

function emit(next: BrowserAuthSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function clearExpiryTimer() {
  if (expiryTimer === undefined) return;
  window.clearTimeout(expiryTimer);
  expiryTimer = undefined;
}

function scheduleSessionExpiry(session: Session | null) {
  clearExpiryTimer();
  if (!session) return;

  const { expiresInMs } = getSessionExpiryState(session);
  if (expiresInMs === null || !Number.isFinite(expiresInMs)) return;

  const refreshLeadTime = 5 * 60 * 1000;
  const delay = Math.max(
    1_000,
    expiresInMs > refreshLeadTime ? expiresInMs - refreshLeadTime : expiresInMs,
  );
  expiryTimer = window.setTimeout(() => {
    expiryTimer = undefined;
    void refreshBrowserAuthState(true);
  }, delay);
}

function snapshotForSession(
  session: Session | null,
  status: BrowserAuthSnapshot["status"] = "ready",
) {
  const expiryState = getSessionExpiryState(session);
  const sessionExpiryWarning =
    expiryState.isWarning && expiryState.expiresInMs !== null
      ? `Session expires in ${Math.max(1, Math.ceil(expiryState.expiresInMs / 60000))} min`
      : null;

  return {
    status,
    session,
    isAdmin: false,
    isTherapist: false,
    sessionExpiryWarning,
    checkedAt: Date.now(),
  } satisfies BrowserAuthSnapshot;
}

export function getBrowserAuthSnapshot() {
  return snapshot;
}

export function subscribeToBrowserAuth(listener: () => void) {
  listeners.add(listener);
  startBrowserAuthState();
  return () => listeners.delete(listener);
}

export async function refreshBrowserAuthState(force = false) {
  if (typeof window === "undefined") return;
  if (refreshPromise) return refreshPromise;
  if (!force && Date.now() - lastRefreshAt < 30_000) return;

  lastRefreshAt = Date.now();
  refreshPromise = (async () => {
    try {
      const session = await getVerifiedBrowserSession();
      if (!session) {
        emit(snapshotForSession(null));
        clearExpiryTimer();
        return;
      }

      const [isAdmin, isTherapist] = await Promise.all([
        hasBrowserRoleForSession(session, "admin"),
        hasBrowserRoleForSession(session, "therapist"),
      ]);
      const next = snapshotForSession(session);
      emit({ ...next, isAdmin, isTherapist });
      scheduleSessionExpiry(session);
    } catch (error) {
      console.error("Browser auth refresh failed.", error);
      emit({ ...snapshot, status: "error", checkedAt: Date.now() });
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function startBrowserAuthState() {
  if (started || typeof window === "undefined") return;
  started = true;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    emit(snapshotForSession(null));
    return;
  }

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (!nextSession) {
      lastRefreshAt = Date.now();
      emit(snapshotForSession(null));
      clearExpiryTimer();
      return;
    }

    if (event === "TOKEN_REFRESHED" && snapshot.session?.user.id === nextSession.user.id) {
      const next = snapshotForSession(nextSession);
      emit({
        ...next,
        isAdmin: snapshot.isAdmin,
        isTherapist: snapshot.isTherapist,
      });
      scheduleSessionExpiry(nextSession);
      return;
    }

    void refreshBrowserAuthState(true);
  });

  const refreshWhenVisible = () => {
    if (!document.hidden) void refreshBrowserAuthState();
  };

  void refreshBrowserAuthState(true);
  window.addEventListener("focus", refreshWhenVisible);
  document.addEventListener("visibilitychange", refreshWhenVisible);
}
