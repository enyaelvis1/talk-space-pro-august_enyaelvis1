// Server-only payment helpers. Never import from client code.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parsePaystackVerification } from "@/lib/payment-validation";

export function isBookingReviewRequired(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "booking_review_required" in metadata &&
    metadata.booking_review_required === true
  );
}

export type PaymentSettings = {
  mode: "test" | "live";
  paystackPublicKey: string | null;
  paystackSecretLast4: string | null;
  hasPaystackSecret: boolean;
  paystackSecretSource: "supabase" | "environment" | null;
  hasPaystackWebhookSecret: boolean;
  isPaystackEnabled: boolean;
  isBankTransferEnabled: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankInstructions: string | null;
  callbackPath: string;
  updatedAt: string;
};

function getEncKey(): Buffer {
  const raw = process.env.EMAIL_SETTINGS_ENC_KEY;
  if (!raw) throw new Error("EMAIL_SETTINGS_ENC_KEY is not configured.");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(ciphertext: string): string {
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted value.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

export async function loadPaymentSettings(): Promise<PaymentSettings> {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select(
      "mode, paystack_public_key, paystack_secret_ciphertext, paystack_secret_last4, paystack_webhook_secret_ciphertext, is_paystack_enabled, is_bank_transfer_enabled, bank_name, bank_account_name, bank_account_number, bank_instructions, callback_path, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;

  const storedSecret = (data?.paystack_secret_ciphertext as string | null) ?? null;
  const environmentSecret = process.env.PAYSTACK_SECRET_KEY?.trim() || null;
  const paystackSecretSource = storedSecret ? "supabase" : environmentSecret ? "environment" : null;

  return {
    mode: (data?.mode as string) === "live" ? "live" : "test",
    paystackPublicKey: (data?.paystack_public_key as string) ?? null,
    paystackSecretLast4:
      (data?.paystack_secret_last4 as string) ?? environmentSecret?.slice(-4) ?? null,
    hasPaystackSecret: paystackSecretSource !== null,
    paystackSecretSource,
    hasPaystackWebhookSecret: Boolean(data?.paystack_webhook_secret_ciphertext),
    isPaystackEnabled: Boolean(data?.is_paystack_enabled),
    isBankTransferEnabled: Boolean(data?.is_bank_transfer_enabled ?? true),
    bankName: (data?.bank_name as string) ?? null,
    bankAccountName: (data?.bank_account_name as string) ?? null,
    bankAccountNumber: (data?.bank_account_number as string) ?? null,
    bankInstructions: (data?.bank_instructions as string) ?? null,
    callbackPath: (data?.callback_path as string) ?? "/book/payment-callback",
    updatedAt: (data?.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function loadPaystackSecret(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select("paystack_secret_ciphertext")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (data?.paystack_secret_ciphertext) {
    try {
      return decryptSecret(data.paystack_secret_ciphertext);
    } catch (err) {
      console.warn("[payments] stored Paystack secret could not be decrypted; falling back", err);
    }
  }
  return process.env.PAYSTACK_SECRET_KEY?.trim() || null;
}

export async function loadPaystackWebhookSecret(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select("paystack_webhook_secret_ciphertext")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (data?.paystack_webhook_secret_ciphertext) {
    try {
      return decryptSecret(data.paystack_webhook_secret_ciphertext);
    } catch (err) {
      console.warn(
        "[payments] stored Paystack webhook secret could not be decrypted; falling back",
        err,
      );
    }
  }
  return process.env.PAYSTACK_WEBHOOK_SECRET?.trim() || null;
}

export function verifyPaystackSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(body).digest("hex");
  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length) return false;
  return timingSafeEqual(sig, exp);
}

/**
 * Paystack API — initialize a transaction. Returns the authorization URL and the
 * provider reference for verification.
 */
export async function paystackInitialize(params: {
  secretKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; providerReference: string; accessCode: string }> {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      currency: "NGN",
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[paystack] initialization rejected", {
      status: res.status,
      response: text.slice(0, 1000),
    });
    throw new Error(`paystack_init_failed:${res.status}:${text}`);
  }
  const parsed = JSON.parse(text) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };
  if (!parsed.status || !parsed.data?.authorization_url) {
    console.error("[paystack] initialization returned an invalid response", {
      message: parsed.message ?? "unknown",
    });
    throw new Error(`paystack_init_rejected:${parsed.message ?? "unknown"}`);
  }
  return {
    authorizationUrl: parsed.data.authorization_url,
    accessCode: parsed.data.access_code ?? "",
    providerReference: parsed.data.reference ?? params.reference,
  };
}

/** Verify a transaction with Paystack. Returns amount (kobo) + status. */
export async function paystackVerify(params: { secretKey: string; reference: string }) {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(params.reference)}`,
    {
      headers: { authorization: `Bearer ${params.secretKey}` },
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`paystack_verify_failed:${res.status}:${text}`);
  const parsed = JSON.parse(text) as {
    status?: boolean;
    data?: Parameters<typeof parsePaystackVerification>[0];
  };
  if (!parsed.status || !parsed.data) throw new Error("paystack_verify_rejected");
  return parsePaystackVerification(parsed.data);
}

export function generatePaymentReference(prefix = "TSP"): string {
  const random = randomBytes(4).toString("hex").toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}
