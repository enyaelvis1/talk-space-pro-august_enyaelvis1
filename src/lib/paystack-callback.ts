const TALKSPACE_HOSTS = new Set(["talkspace.ng", "www.talkspace.ng"]);

export function normalizePaystackCallbackPath(value?: string | null): string {
  const configured = value?.trim() || "/book/payment-callback";
  try {
    const parsed = new URL(configured, "https://talkspace.ng");
    if (parsed.pathname === "/api/public/paystack-webhook") {
      return "/book/payment-callback";
    }
    return parsed.pathname || "/book/payment-callback";
  } catch {
    return "/book/payment-callback";
  }
}

function normalizeOrigin(origin: string): URL {
  const value = origin.trim();
  return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
}

/**
 * Builds the customer return URL for a Paystack checkout.
 *
 * The Paystack webhook is a provider-to-server endpoint and must never be used
 * as the browser return URL. Older settings may contain a full URL (or the
 * webhook path), so normalize those values without ever concatenating URLs.
 */
export function buildPaystackCallbackUrl(input: {
  origin: string;
  callbackPath?: string | null;
  reference: string;
}): string {
  const origin = normalizeOrigin(input.origin);
  const configured = input.callbackPath?.trim() || "/book/payment-callback";
  const target = new URL(
    /^https?:\/\//i.test(configured)
      ? configured
      : configured.startsWith("/")
        ? configured
        : `/${configured}`,
    origin,
  );

  const sameOrigin = target.origin === origin.origin;
  const talkSpaceHost =
    TALKSPACE_HOSTS.has(target.hostname) && TALKSPACE_HOSTS.has(origin.hostname);
  if (!sameOrigin && !talkSpaceHost) {
    throw new Error("Paystack callback must use the application origin.");
  }

  const pathname =
    target.pathname === "/api/public/paystack-webhook"
      ? "/book/payment-callback"
      : target.pathname || "/book/payment-callback";
  const callback = new URL(pathname, origin);
  target.searchParams.forEach((value, key) => {
    if (key !== "reference" && key !== "trxref") callback.searchParams.set(key, value);
  });
  callback.searchParams.set("reference", input.reference);
  callback.searchParams.set("trxref", input.reference);
  return callback.toString();
}
