import "../instrument.server.mjs";
import "./lib/error-capture";

import * as Sentry from "@sentry/tanstackstart-react";

import { consumeLastCapturedError } from "./lib/error-capture";
import { describeError, renderErrorPage } from "./lib/error-page";
import { getLegacyRedirect } from "./lib/legacy-redirects";
import { applySecurityHeaders } from "./lib/security-headers";
import {
  PUBLIC_DOCUMENT_CDN_CACHE_CONTROL,
  isPublicDocumentRequest,
} from "./lib/public-document-cache";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};
type SentryServerEntry = Parameters<typeof Sentry.wrapFetchWithSentry>[0];

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  try {
    return await serverEntryPromise;
  } catch (error) {
    // A module can be temporarily unavailable while Vite replaces the SSR
    // graph. Never retain that rejected promise: doing so makes every future
    // request fail even after the rebuild has completed.
    serverEntryPromise = undefined;
    throw error;
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"}, try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  Sentry.captureException(captured, {
    tags: { surface: "h3_swallowed_ssr_error", path: new URL(request.url).pathname },
  });
  console.error(captured);
  return new Response(renderErrorPage(describeError(captured, new URL(request.url).pathname)), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function hasSupabaseAuthCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)sb-[^=]*auth-token(?:\.\d+)?=/.test(cookie);
}

function applyPublicDocumentCache(response: Response, request: Request): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (
    response.status !== 200 ||
    !contentType.includes("text/html") ||
    response.headers.has("set-cookie") ||
    !isPublicDocumentRequest(request)
  ) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("CDN-Cache-Control", PUBLIC_DOCUMENT_CDN_CACHE_CONTROL);
  return new Response(response.body, { status: response.status, headers });
}

function getLoggedOutProtectedRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const isProtectedRoute =
    url.pathname === "/account" ||
    url.pathname.startsWith("/account/") ||
    url.pathname === "/admin" ||
    url.pathname.startsWith("/admin/");
  if (!isProtectedRoute || hasSupabaseAuthCookie(request)) return null;

  const loginUrl = new URL("/login", url);
  loginUrl.searchParams.set("redirect", `${url.pathname}${url.search}${url.hash}`);
  return new Response(null, {
    status: 307,
    headers: { Location: loginUrl.toString() },
  });
}

const serverHandler: ServerEntry = {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const protectedRedirect = getLoggedOutProtectedRedirect(request);
      if (protectedRedirect) return applySecurityHeaders(protectedRedirect);

      const legacyRedirect = await getLegacyRedirect(request);
      if (legacyRedirect) {
        return applySecurityHeaders(
          new Response(null, {
            status: legacyRedirect.status,
            headers: { Location: legacyRedirect.url.toString() },
          }),
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response, request);
      return applySecurityHeaders(applyPublicDocumentCache(normalized, request));
    } catch (error) {
      console.error(error);
      let path: string | undefined;
      try {
        path = new URL(request.url).pathname;
      } catch {
        path = undefined;
      }
      Sentry.captureException(error, {
        tags: { surface: "server_entry_fetch", ...(path ? { path } : {}) },
      });
      return applySecurityHeaders(
        new Response(renderErrorPage(describeError(error, path)), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};

export default Sentry.wrapFetchWithSentry(serverHandler as unknown as SentryServerEntry);
