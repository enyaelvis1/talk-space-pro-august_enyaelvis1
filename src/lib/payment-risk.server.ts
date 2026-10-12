import { requestIdentifier } from "@/lib/rate-limit.server";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function paymentRiskChallengeSiteKey(): string | null {
  const siteKey = process.env["VITE_TURNSTILE_SITE_KEY"]?.trim();
  const secretKey = process.env["TURNSTILE_SECRET_KEY"]?.trim();
  return siteKey && secretKey ? siteKey : null;
}

export async function verifyPaymentRiskChallenge(input: {
  token?: string | null;
  request: Request;
}): Promise<void> {
  const secretKey = process.env["TURNSTILE_SECRET_KEY"]?.trim();
  const siteKey = process.env["VITE_TURNSTILE_SITE_KEY"]?.trim();
  if (!secretKey && !siteKey) return;
  if (!secretKey || !siteKey) {
    throw new Error("Payment protection is not configured correctly. Please try again later.");
  }
  if (!input.token?.trim()) {
    throw new Error("Complete the security check before continuing to payment.");
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: input.token.trim(),
    remoteip: requestIdentifier(input.request),
  });
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("Payment security verification is temporarily unavailable. Please try again.");
  }

  const result = (await response.json()) as { success?: boolean };
  if (!result.success) {
    throw new Error("The security check could not be verified. Please try again.");
  }
}
