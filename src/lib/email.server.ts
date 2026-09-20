// Server-only email helpers. Never import from client code.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderEmailTemplate, type EmailTemplateKey } from "@/lib/email-templates.server";
import { notificationSuppressionReason } from "@/lib/notification-policy";

export type EmailSettings = {
  provider: string;
  senderDomain: string | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  contactInbox: string | null;
  zohoRoutingEnabled: boolean;
  isEnabled: boolean;
  apiKeyLast4: string | null;
  hasApiKey: boolean;
};

export type EmailTemplateRow = {
  templateKey: EmailTemplateKey;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  subjectOverride: string | null;
};

function getEncKey(): Buffer {
  const raw = process.env.EMAIL_SETTINGS_ENC_KEY;
  if (!raw) throw new Error("EMAIL_SETTINGS_ENC_KEY is not configured.");
  // Derive a deterministic 32-byte key from whatever the secret is.
  return createHash("sha256").update(raw).digest();
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptApiKey(ciphertext: string): string {
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted API key.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

export async function loadEmailSettings(): Promise<EmailSettings> {
  const { data, error } = await supabaseAdmin
    .from("email_settings")
    .select(
      "provider, api_key_ciphertext, api_key_last4, sender_domain, from_name, from_email, reply_to, contact_inbox, zoho_routing_enabled, is_enabled",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    provider: data?.provider ?? "resend",
    senderDomain: data?.sender_domain ?? null,
    fromName: data?.from_name ?? null,
    fromEmail: data?.from_email ?? null,
    replyTo: data?.reply_to ?? null,
    contactInbox: data?.contact_inbox ?? null,
    zohoRoutingEnabled: Boolean(data?.zoho_routing_enabled),
    isEnabled: Boolean(data?.is_enabled),
    apiKeyLast4: data?.api_key_last4 ?? null,
    hasApiKey: Boolean(data?.api_key_ciphertext),
  };
}

export async function loadTemplateSettings(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabaseAdmin
    .from("email_template_settings")
    .select("template_key, display_name, description, is_enabled, subject_override")
    .order("template_key");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    templateKey: row.template_key as EmailTemplateKey,
    displayName: row.display_name,
    description: row.description,
    isEnabled: row.is_enabled,
    subjectOverride: row.subject_override,
  }));
}

async function loadTemplateRow(key: EmailTemplateKey) {
  const { data, error } = await supabaseAdmin
    .from("email_template_settings")
    .select("template_key, is_enabled, subject_override")
    .eq("template_key", key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type SendResult =
  | { sent: true; providerId: string | null; logId: string | null }
  | { sent: false; reason: string; logId: string | null };

type RetryTrigger = "initial" | "automatic" | "manual";

type SendOptions = {
  retryCount?: number;
  retriedFrom?: string | null;
  retryTrigger?: RetryTrigger;
  retryActorId?: string | null;
  replyTo?: string | null;
};

type RetryEnvelope =
  | {
      kind: "template";
      templateKey: EmailTemplateKey;
      recipient: string;
      data: Record<string, unknown>;
    }
  | { kind: "raw"; recipient: string; subject: string; html: string };

const MAX_AUTOMATIC_RETRIES = 3;

function nextRetryAt(retryCount: number): string | null {
  const delays = [5, 15, 60];
  const minutes = delays[retryCount];
  return minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
}

function encryptRetryEnvelope(envelope: RetryEnvelope): string {
  return encryptApiKey(JSON.stringify(envelope));
}

function decryptRetryEnvelope(ciphertext: string): RetryEnvelope {
  return JSON.parse(decryptApiKey(ciphertext)) as RetryEnvelope;
}

async function recordLog(entry: {
  templateKey: string | null;
  recipient: string;
  subject: string | null;
  status: "sent" | "failed" | "skipped";
  reason?: string | null;
  providerId?: string | null;
  error?: string | null;
  context?: Record<string, unknown> | null;
  retryPayloadCiphertext?: string | null;
  retryCount?: number;
  nextRetryAt?: string | null;
  retriedFrom?: string | null;
  retryTrigger?: RetryTrigger;
  retryActorId?: string | null;
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("email_delivery_logs")
      .insert({
        template_key: entry.templateKey,
        recipient: entry.recipient,
        subject: entry.subject,
        status: entry.status,
        reason: entry.reason ?? null,
        provider_id: entry.providerId ?? null,
        error: entry.error ?? null,
        context: (entry.context ?? null) as never,
        retry_payload_ciphertext: entry.retryPayloadCiphertext ?? null,
        retry_count: entry.retryCount ?? 0,
        next_retry_at: entry.nextRetryAt ?? null,
        retried_from: entry.retriedFrom ?? null,
        retry_trigger: entry.retryTrigger ?? "initial",
        retry_actor_id: entry.retryActorId ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  } catch (err) {
    console.error("[email] failed to write delivery log", err);
    return null;
  }
}

async function loadDecryptedApiKey(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("email_settings")
    .select("api_key_ciphertext")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.api_key_ciphertext) return null;
  return decryptApiKey(data.api_key_ciphertext);
}

function formatFrom(settings: EmailSettings): string | null {
  if (!settings.fromEmail) return null;
  return settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
}

async function callResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}): Promise<{ id: string | null }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo || undefined,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Resend rejected the request [${res.status}]: ${bodyText}`);
  }
  try {
    const parsed = JSON.parse(bodyText) as { id?: string };
    return { id: parsed.id ?? null };
  } catch {
    return { id: null };
  }
}

export async function sendTemplateEmail(
  templateKey: EmailTemplateKey,
  to: string,
  data: Record<string, unknown> = {},
  options: SendOptions = {},
): Promise<SendResult> {
  const suppressed = await notificationSuppressionReason(
    templateKey,
    data,
    async (reference) => {
      const { data: booking, error } = await supabaseAdmin
        .from("appointments")
        .select("status, archived_at")
        .eq("booking_reference", reference)
        .maybeSingle();
      if (error) throw error;
      return booking;
    },
    async (id) => {
      const { data: intake, error } = await supabaseAdmin
        .from("intake_submissions")
        .select("source, completion_state")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return intake;
    },
  );
  if (suppressed) {
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject: null,
      status: "skipped",
      reason: suppressed,
      retryCount: options.retryCount,
      retriedFrom: options.retriedFrom,
      retryTrigger: options.retryTrigger,
      retryActorId: options.retryActorId,
    });
    return { sent: false, reason: suppressed, logId };
  }
  const settings = await loadEmailSettings();
  if (!settings.isEnabled) {
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject: null,
      status: "skipped",
      reason: "emails_disabled",
    });
    return { sent: false, reason: "emails_disabled", logId };
  }
  if (!settings.fromEmail) {
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject: null,
      status: "skipped",
      reason: "from_email_not_configured",
    });
    return { sent: false, reason: "from_email_not_configured", logId };
  }
  const template = await loadTemplateRow(templateKey);
  if (template && !template.is_enabled) {
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject: null,
      status: "skipped",
      reason: "template_disabled",
    });
    return { sent: false, reason: "template_disabled", logId };
  }
  const apiKey = await loadDecryptedApiKey();
  if (!apiKey) {
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject: null,
      status: "skipped",
      reason: "api_key_not_configured",
    });
    return { sent: false, reason: "api_key_not_configured", logId };
  }

  const rendered = renderEmailTemplate(templateKey, data);
  const subject = template?.subject_override?.trim() || rendered.subject;
  const from = formatFrom(settings)!;

  try {
    const result = await callResend({
      apiKey,
      from,
      to,
      subject,
      html: rendered.html,
      replyTo: options.replyTo ?? settings.replyTo,
    });
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject,
      status: "sent",
      providerId: result.id,
      retryCount: options.retryCount,
      retriedFrom: options.retriedFrom,
      retryTrigger: options.retryTrigger,
      retryActorId: options.retryActorId,
    });
    return { sent: true, providerId: result.id, logId };
  } catch (err) {
    console.error(`[email] send failed for template=${templateKey}`, err);
    const msg = err instanceof Error ? err.message : "send_failed";
    const retryCount = options.retryCount ?? 0;
    const logId = await recordLog({
      templateKey,
      recipient: to,
      subject,
      status: "failed",
      reason: "send_failed",
      error: msg,
      retryPayloadCiphertext: encryptRetryEnvelope({
        kind: "template",
        templateKey,
        recipient: to,
        data,
      }),
      retryCount,
      nextRetryAt: retryCount < MAX_AUTOMATIC_RETRIES ? nextRetryAt(retryCount) : null,
      retriedFrom: options.retriedFrom,
      retryTrigger: options.retryTrigger,
      retryActorId: options.retryActorId,
    });
    return { sent: false, reason: msg, logId };
  }
}

export async function sendRawEmail(
  params: {
    to: string;
    subject: string;
    html: string;
  },
  options: SendOptions = {},
): Promise<SendResult> {
  const settings = await loadEmailSettings();
  if (!settings.isEnabled) {
    const logId = await recordLog({
      templateKey: null,
      recipient: params.to,
      subject: params.subject,
      status: "skipped",
      reason: "emails_disabled",
    });
    return { sent: false, reason: "emails_disabled", logId };
  }
  if (!settings.fromEmail) {
    const logId = await recordLog({
      templateKey: null,
      recipient: params.to,
      subject: params.subject,
      status: "skipped",
      reason: "from_email_not_configured",
    });
    return { sent: false, reason: "from_email_not_configured", logId };
  }
  const apiKey = await loadDecryptedApiKey();
  if (!apiKey) {
    const logId = await recordLog({
      templateKey: null,
      recipient: params.to,
      subject: params.subject,
      status: "skipped",
      reason: "api_key_not_configured",
    });
    return { sent: false, reason: "api_key_not_configured", logId };
  }
  const from = formatFrom(settings)!;
  try {
    const result = await callResend({
      apiKey,
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: settings.replyTo,
    });
    const logId = await recordLog({
      templateKey: null,
      recipient: params.to,
      subject: params.subject,
      status: "sent",
      providerId: result.id,
      retryCount: options.retryCount,
      retriedFrom: options.retriedFrom,
      retryTrigger: options.retryTrigger,
      retryActorId: options.retryActorId,
    });
    return { sent: true, providerId: result.id, logId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send_failed";
    const retryCount = options.retryCount ?? 0;
    const logId = await recordLog({
      templateKey: null,
      recipient: params.to,
      subject: params.subject,
      status: "failed",
      reason: "send_failed",
      error: msg,
      retryPayloadCiphertext: encryptRetryEnvelope({
        kind: "raw",
        ...params,
        recipient: params.to,
      }),
      retryCount,
      nextRetryAt: retryCount < MAX_AUTOMATIC_RETRIES ? nextRetryAt(retryCount) : null,
      retriedFrom: options.retriedFrom,
      retryTrigger: options.retryTrigger,
      retryActorId: options.retryActorId,
    });
    return { sent: false, reason: msg, logId };
  }
}

export async function retryLoggedEmail(
  logId: string,
  options: { trigger: "automatic" | "manual"; actorId?: string | null },
): Promise<SendResult> {
  const { data: log, error } = await supabaseAdmin
    .from("email_delivery_logs")
    .select("id, status, retry_payload_ciphertext, retry_count")
    .eq("id", logId)
    .maybeSingle();
  if (error) throw error;
  if (!log || log.status !== "failed") throw new Error("Only failed emails can be retried.");
  if (!log.retry_payload_ciphertext) throw new Error("This delivery does not contain retry data.");
  const retryCount = Number(log.retry_count ?? 0) + 1;
  if (options.trigger === "automatic" && retryCount > MAX_AUTOMATIC_RETRIES) {
    throw new Error("Automatic retry limit reached.");
  }
  if (retryCount > 5) throw new Error("Retry limit reached.");

  await supabaseAdmin.from("email_delivery_logs").update({ next_retry_at: null }).eq("id", logId);

  const envelope = decryptRetryEnvelope(log.retry_payload_ciphertext);
  const sendOptions: SendOptions = {
    retryCount,
    retriedFrom: logId,
    retryTrigger: options.trigger,
    retryActorId: options.actorId ?? null,
  };
  if (envelope.kind === "template") {
    return sendTemplateEmail(envelope.templateKey, envelope.recipient, envelope.data, sendOptions);
  }
  return sendRawEmail(
    { to: envelope.recipient, subject: envelope.subject, html: envelope.html },
    sendOptions,
  );
}

export async function processDueEmailRetries(limit = 25) {
  const { data, error } = await supabaseAdmin
    .from("email_delivery_logs")
    .select("id")
    .eq("status", "failed")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .lt("retry_count", MAX_AUTOMATIC_RETRIES)
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results: Array<{ id: string; sent: boolean; reason?: string }> = [];
  for (const row of data ?? []) {
    try {
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("email_delivery_logs")
        .update({ next_retry_at: null })
        .eq("id", row.id)
        .not("next_retry_at", "is", null)
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;
      const result = await retryLoggedEmail(row.id, { trigger: "automatic" });
      results.push({
        id: row.id,
        sent: result.sent,
        ...(!result.sent && { reason: result.reason }),
      });
    } catch (error) {
      results.push({
        id: row.id,
        sent: false,
        reason: error instanceof Error ? error.message : "retry_failed",
      });
    }
  }
  return { scanned: data?.length ?? 0, results };
}
