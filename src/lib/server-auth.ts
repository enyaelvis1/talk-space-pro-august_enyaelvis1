import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { User } from "@supabase/supabase-js";

import { createRequestSupabase, type RequestSupabase } from "@/lib/supabase-server";

export type ServerAppRole = "admin" | "staff" | "client" | "therapist";

export type RequestAuthMetrics = {
  userLookups: number;
  roleChecks: Record<ServerAppRole, number>;
};

export type RequestAuthContext = {
  bag: RequestSupabase;
  user: User | null;
  hasRole: (role: ServerAppRole) => Promise<boolean>;
  metrics: Readonly<RequestAuthMetrics>;
};

type AuthenticatedRequestAuthContext = RequestAuthContext & { user: User };

const contexts = new WeakMap<Request, Promise<RequestAuthContext | null>>();

function createMetrics(): RequestAuthMetrics {
  return { userLookups: 0, roleChecks: {} as Record<ServerAppRole, number> };
}

function publishMetrics(metrics: RequestAuthMetrics) {
  if (process.env.TALKSPACE_AUTH_METRICS !== "1") return;
  setResponseHeader("X-Talkspace-Auth-User-Lookups", String(metrics.userLookups));
  setResponseHeader("X-Talkspace-Auth-Role-Checks", JSON.stringify(metrics.roleChecks));
}

export function getRequestAuthContext(): Promise<RequestAuthContext | null> {
  const request = getRequest();
  const existing = contexts.get(request);
  if (existing) return existing;

  const context = (async () => {
    const bag = createRequestSupabase(request);
    if (!bag) return null;

    const metrics = createMetrics();
    metrics.userLookups += 1;

    const {
      data: { user },
    } = await bag.client.auth.getUser();
    bag.commitCookies();
    publishMetrics(metrics);

    const roleChecks = new Map<ServerAppRole, Promise<boolean>>();
    return {
      bag,
      user,
      hasRole(role) {
        const cached = roleChecks.get(role);
        if (cached) return cached;

        const check = (async () => {
          if (!user) return false;
          metrics.roleChecks[role] = (metrics.roleChecks[role] ?? 0) + 1;
          publishMetrics(metrics);
          const { data, error } = await bag.client.rpc("has_role", {
            _user_id: user.id,
            _role: role,
          });
          return !error && data === true;
        })();
        roleChecks.set(role, check);
        return check;
      },
      metrics,
    } satisfies RequestAuthContext;
  })();

  contexts.set(request, context);
  return context;
}

export async function getRequestAuthMetrics(): Promise<RequestAuthMetrics | null> {
  return (await getRequestAuthContext())?.metrics ?? null;
}

export async function requireRequestRole(
  role: ServerAppRole,
  message = `${role[0].toUpperCase()}${role.slice(1)} permission required.`,
): Promise<AuthenticatedRequestAuthContext> {
  const context = await getRequestAuthContext();
  if (!context?.user) throw new Error("Sign in required.");
  if (!(await context.hasRole(role))) throw new Error(message);
  return { ...context, user: context.user };
}
