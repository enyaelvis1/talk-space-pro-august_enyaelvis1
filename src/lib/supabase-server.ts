import { createServerClient } from "@supabase/ssr";
import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setResponseHeader } from "@tanstack/react-start/server";

export type RequestSupabase = {
  client: SupabaseClient;
  commitCookies: () => void;
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function getServerConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  return url && key ? { url, key } : null;
}

export function createRequestSupabase(request: Request) {
  const config = getServerConfig();
  if (!config) return null;

  const authorization = request.headers.get("authorization");
  if (authorization) {
    const client = createClient(config.url, config.key, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { Authorization: authorization },
        fetch: createSupabaseFetch(config.key),
      },
    });

    return {
      client,
      commitCookies() {},
    } satisfies RequestSupabase;
  }

  const pendingCookies: string[] = [];
  const client = createServerClient(config.url, config.key, {
    auth: { flowType: "pkce" },
    global: { fetch: createSupabaseFetch(config.key) },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "");
      },
      setAll(cookiesToSet) {
        pendingCookies.push(
          ...cookiesToSet.map(({ name, value, options }) =>
            serializeCookieHeader(name, value, options),
          ),
        );
      },
    },
  });

  return {
    client,
    commitCookies() {
      if (pendingCookies.length > 0) {
        setResponseHeader("Set-Cookie", pendingCookies);
      }
    },
  } satisfies RequestSupabase;
}

export function isProtectedPath(pathname: string) {
  return (
    pathname === "/account" || pathname.startsWith("/admin") || pathname.startsWith("/therapist")
  );
}

export function loginRedirectUrl(request: Request) {
  const url = new URL(request.url);
  const destination = `${url.pathname}${url.search}`;
  return `/login?redirect=${encodeURIComponent(destination)}`;
}
