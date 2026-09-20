const LEGACY_REDIRECTS: Record<string, string> = {
  "/beyondsilence": "/blog/beyondsilence",
  "/choose-wisely-we-only-get-time-and-choice": "/blog/choose-wisely-we-only-get-time-and-choice",
  "/contact-08099931039-for-professional-guidance-and-support": "/contact",
  "/counseling-services": "/about",
  "/everybody-go-dey-alright": "/blog/everybody-go-dey-alright",
  "/blogs": "/blog",
  "/never-struggle-in-your-marriage-again": "/blog/never-struggle-in-your-marriage-again",
  "/whymarriagedoesnotwork": "/blog/whymarriagedoesnotwork",
};

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return (normalized || "/").toLowerCase();
}

type DbRedirect = { from_path: string; to_path: string; status_code: number };

const CACHE_TTL_MS = 60_000;
let cacheAt = 0;
let cacheMap: Map<string, { to: string; status: number }> = new Map();
let inflight: Promise<void> | undefined;

async function refreshDbRedirects(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  const endpoint = `${url}/rest/v1/redirects?select=from_path,to_path,status_code&is_active=eq.true`;
  try {
    const resp = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!resp.ok) return;
    const rows = (await resp.json()) as DbRedirect[];
    const next = new Map<string, { to: string; status: number }>();
    for (const r of rows) {
      next.set(normalizePathname(r.from_path), { to: r.to_path, status: r.status_code });
    }
    cacheMap = next;
    cacheAt = Date.now();
  } catch {
    // swallow — legacy static table still applies
  }
}

async function ensureFresh(): Promise<void> {
  if (Date.now() - cacheAt < CACHE_TTL_MS) return;
  if (!inflight) {
    inflight = refreshDbRedirects().finally(() => {
      inflight = undefined;
    });
  }
  await inflight;
}

export async function getLegacyRedirect(
  request: Request,
): Promise<{ url: URL; status: number } | undefined> {
  const requestUrl = new URL(request.url);
  const key = normalizePathname(requestUrl.pathname);

  await ensureFresh();
  const dbHit = cacheMap.get(key);
  if (dbHit) {
    const targetUrl = /^https?:\/\//i.test(dbHit.to)
      ? new URL(dbHit.to)
      : new URL(dbHit.to, requestUrl.origin);
    if (!/\?/.test(dbHit.to)) targetUrl.search = requestUrl.search;
    return { url: targetUrl, status: dbHit.status };
  }

  const staticTarget = LEGACY_REDIRECTS[key];
  if (!staticTarget) return undefined;
  const targetUrl = new URL(staticTarget, requestUrl.origin);
  targetUrl.search = requestUrl.search;
  return { url: targetUrl, status: 301 };
}

export { LEGACY_REDIRECTS };
