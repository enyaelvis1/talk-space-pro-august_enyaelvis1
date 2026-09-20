const MAX_AUTOMATIC_RETRIES = 1;
const RETRY_WINDOW_MS = 30_000;

const attempts = new Map<string, { count: number; expiresAt: number }>();

export function routeRecoveryKey(pathname: string, error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown");
  return `${pathname}:${message}`;
}

export function claimAutomaticRouteRetry(key: string, now = Date.now()) {
  for (const [entryKey, entry] of attempts) {
    if (entry.expiresAt <= now) attempts.delete(entryKey);
  }

  const current = attempts.get(key);
  if (current && current.expiresAt > now && current.count >= MAX_AUTOMATIC_RETRIES) {
    return false;
  }

  const count = current && current.expiresAt > now ? current.count + 1 : 1;
  attempts.set(key, { count, expiresAt: now + RETRY_WINDOW_MS });
  return count <= MAX_AUTOMATIC_RETRIES;
}

export function clearAutomaticRouteRetry(key: string) {
  attempts.delete(key);
}
