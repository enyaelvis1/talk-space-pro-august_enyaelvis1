/**
 * Database-backed rate limiting and security event logging.
 *
 * Public endpoints (contact form, booking hold, manage-token lookup) run on a
 * stateless edge runtime, so counters have to live in the database. The
 * `consume_rate_limit` function increments a fixed-window counter atomically
 * and reports whether the caller is still within budget.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

/** SHA-256 of the caller's IP, so we never store a raw address. */
export async function hashIdentifier(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

export function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(
    "consume_rate_limit" as never,
    {
      p_bucket: options.bucket,
      p_identifier: options.identifier,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    } as never,
  );

  if (error) {
    // Never block legitimate traffic because the limiter itself failed.
    console.error("[rate-limit] check failed:", error);
    return { allowed: true, remaining: options.limit, retryAfterSeconds: 0 };
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    allowed?: boolean;
    remaining?: number;
    retry_after_seconds?: number;
  } | null;

  return {
    allowed: row?.allowed !== false,
    remaining: Number(row?.remaining ?? 0),
    retryAfterSeconds: Number(row?.retry_after_seconds ?? 0),
  };
}

export async function logSecurityEvent(event: {
  type: string;
  identifier?: string | null;
  route?: string | null;
  severity?: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc(
      "log_security_event" as never,
      {
        p_event_type: event.type,
        p_identifier: event.identifier ?? null,
        p_route: event.route ?? null,
        p_severity: event.severity ?? "warning",
        p_details: event.details ?? {},
      } as never,
    );
  } catch (error) {
    console.error("[security-events] failed to log:", error);
  }
}

export function formatRateLimitMessage(retryAfterSeconds: number, action: string): string {
  const minutes = Math.ceil(Math.max(retryAfterSeconds, 1) / 60);
  return `Too many ${action} attempts from this device. Please try again in about ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

/**
 * Convenience wrapper for public endpoints: throttles by hashed IP and records
 * a security event whenever a caller is blocked.
 */
export async function guardPublicRequest(params: {
  request: Request;
  bucket: string;
  limit: number;
  windowSeconds: number;
  route: string;
  action: string;
}): Promise<void> {
  const identifier = await hashIdentifier(requestIdentifier(params.request));
  const result = await consumeRateLimit({
    bucket: params.bucket,
    identifier,
    limit: params.limit,
    windowSeconds: params.windowSeconds,
  });
  if (!result.allowed) {
    await logSecurityEvent({
      type: "rate_limit_blocked",
      identifier,
      route: params.route,
      details: { bucket: params.bucket, limit: params.limit, window: params.windowSeconds },
    });
    throw new Error(formatRateLimitMessage(result.retryAfterSeconds, params.action));
  }
}
