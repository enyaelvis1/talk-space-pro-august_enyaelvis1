/**
 * Shared authentication for scheduled/cron endpoints under /api/public/hooks/*.
 *
 * The /api/public prefix bypasses site auth, so every hook MUST verify the
 * caller itself. The shared secret lives in CRON_SECRET and is compared in
 * constant time to avoid leaking it through response timing.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  // Compare a fixed number of bytes so length differences do not short-circuit.
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function extractCronSecret(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-cron-secret")?.trim() ?? "";
}

/**
 * Returns a 401/503 Response when the request is not an authorised cron call,
 * or `null` when the caller may proceed.
 */
export function verifyCronRequest(request: Request): Response | null {
  const expected = process.env["CRON_SECRET"];
  if (!expected) {
    return new Response(JSON.stringify({ ok: false, error: "cron_secret_not_configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  const provided = extractCronSecret(request);
  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
