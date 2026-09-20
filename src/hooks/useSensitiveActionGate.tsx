import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase";

const STEP_UP_STORAGE_KEY = "talkspace-admin-step-up-at";
const STEP_UP_TTL_MS = 10 * 60 * 1000;

export type AssuranceLevel = "aal1" | "aal2" | string | null;

export type SensitiveActionGateState = {
  open: boolean;
  reason: string;
  email: string;
  busy: boolean;
  error: string;
  currentLevel: AssuranceLevel;
  nextLevel: AssuranceLevel;
  stepUpExpiresAt: number | null;
};

function readStepUpExpiry() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STEP_UP_STORAGE_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function writeStepUpExpiry(expiry: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STEP_UP_STORAGE_KEY, String(expiry));
}

export function isStepUpFresh() {
  const expiry = readStepUpExpiry();
  return expiry != null && expiry > Date.now();
}

function clearStepUp() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STEP_UP_STORAGE_KEY);
}

export function useSensitiveActionGate() {
  const [state, setState] = useState<SensitiveActionGateState>({
    open: false,
    reason: "",
    email: "",
    busy: false,
    error: "",
    currentLevel: null,
    nextLevel: null,
    stepUpExpiresAt: readStepUpExpiry(),
  });
  const resolveRef = useRef<((allowed: boolean) => void) | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const email = data.user?.email ?? "";
      if (email) {
        setState((current) => ({ ...current, email }));
      }
    });

    void supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (!active || !data) return;
        setState((current) => ({
          ...current,
          currentLevel: data.currentLevel ?? null,
          nextLevel: data.nextLevel ?? null,
        }));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const finish = useCallback((allowed: boolean) => {
    resolveRef.current?.(allowed);
    resolveRef.current = null;
    setState((current) => ({
      ...current,
      open: false,
      busy: false,
      error: "",
      reason: "",
    }));
  }, []);

  const requestStepUp = useCallback(async (reason: string) => {
    const expiry = readStepUpExpiry();
    if (expiry && expiry > Date.now()) {
      setState((current) => ({ ...current, stepUpExpiresAt: expiry }));
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState((current) => ({
        ...current,
        open: true,
        reason,
        busy: false,
        error: "",
        stepUpExpiresAt: expiry,
      }));
    });
  }, []);

  const cancelStepUp = useCallback(() => {
    clearStepUp();
    finish(false);
  }, [finish]);

  const confirmStepUp = useCallback(
    async (password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setState((current) => ({
          ...current,
          busy: false,
          error: "Supabase is not configured.",
        }));
        return;
      }

      setState((current) => ({ ...current, busy: true, error: "" }));

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? state.email;
      if (!email) {
        setState((current) => ({
          ...current,
          busy: false,
          error: "We couldn't confirm the signed-in account.",
        }));
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setState((current) => ({ ...current, busy: false, error: error.message }));
        return;
      }

      const expiry = Date.now() + STEP_UP_TTL_MS;
      writeStepUpExpiry(expiry);
      setState((current) => ({
        ...current,
        email,
        stepUpExpiresAt: expiry,
        currentLevel: current.currentLevel ?? "aal1",
        nextLevel: current.nextLevel ?? "aal2",
      }));
      finish(true);
    },
    [finish, state.email],
  );

  return {
    dialogState: state,
    requestStepUp,
    cancelStepUp,
    confirmStepUp,
  };
}
