import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireRequestRole } from "@/lib/server-auth";

async function requireAdmin() {
  const context = await requireRequestRole("admin");
  return { userId: context.user.id, email: context.user.email ?? null };
}

function noStore() {
  setResponseHeader("Cache-Control", "private, no-store");
}

export type EmailSettingsDTO = {
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

export type EmailTemplateDTO = {
  templateKey: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  subjectOverride: string | null;
  bodyOverride: string | null;
};

async function loadEmailAdminData() {
  const { loadEmailSettings, loadTemplateSettings } = await import("@/lib/email.server");
  const [settings, templates] = await Promise.all([loadEmailSettings(), loadTemplateSettings()]);
  return { settings: settings as EmailSettingsDTO, templates: templates as EmailTemplateDTO[] };
}

export const getEmailAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const data = await loadEmailAdminData();
  noStore();
  return data;
});

const settingsInput = z
  .object({
    provider: z.enum(["resend"]).default("resend"),
    senderDomain: z.string().trim().max(255).nullable().optional(),
    fromName: z.string().trim().max(120).nullable().optional(),
    fromEmail: z.string().trim().email().max(255).nullable().optional(),
    replyTo: z.string().trim().email().max(255).nullable().optional(),
    contactInbox: z.string().trim().email().max(255).nullable().optional(),
    zohoRoutingEnabled: z.boolean(),
    isEnabled: z.boolean(),
  })
  .superRefine((data, context) => {
    if (data.zohoRoutingEnabled && !data.contactInbox) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactInbox"],
        message: "Add the confirmed Zoho recipient before enabling Zoho routing.",
      });
    }
  });

export const updateEmailSettings = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof settingsInput>) => settingsInput.parse(data))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_settings")
      .update({
        provider: data.provider,
        sender_domain: data.senderDomain || null,
        from_name: data.fromName || null,
        from_email: data.fromEmail || null,
        reply_to: data.replyTo || null,
        contact_inbox: data.contactInbox || null,
        zoho_routing_enabled: data.zohoRoutingEnabled,
        is_enabled: data.isEnabled,
        updated_by: userId,
      })
      .eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

const apiKeyInput = z.object({
  apiKey: z.string().trim().min(10).max(512),
});

export const setEmailApiKey = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof apiKeyInput>) => apiKeyInput.parse(data))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { encryptApiKey } = await import("@/lib/email.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const last4 = data.apiKey.slice(-4);
    const { error } = await supabaseAdmin
      .from("email_settings")
      .update({
        api_key_ciphertext: encryptApiKey(data.apiKey),
        api_key_last4: last4,
        updated_by: userId,
      })
      .eq("id", 1);
    if (error) throw error;
    return { ok: true, last4 };
  });

export const clearEmailApiKey = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("email_settings")
    .update({ api_key_ciphertext: null, api_key_last4: null, updated_by: userId })
    .eq("id", 1);
  if (error) throw error;
  return { ok: true };
});

const templateInput = z.object({
  templateKey: z.string().min(1).max(64),
  isEnabled: z.boolean(),
  subjectOverride: z.string().trim().max(200).nullable().optional(),
  bodyOverride: z.string().trim().max(12000).nullable().optional(),
});

export const updateEmailTemplate = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof templateInput>) => templateInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_template_settings")
      .update({
        is_enabled: data.isEnabled,
        subject_override: data.subjectOverride?.trim() || null,
        body_override: data.bodyOverride?.trim() || null,
      })
      .eq("template_key", data.templateKey);
    if (error) throw error;
    return { ok: true };
  });

const testInput = z.object({ to: z.string().trim().email().max(255) });

const templateKeySchema = z.enum([
  "booking_confirmation",
  "booking_admin_notice",
  "therapist_booking_notice",
  "therapist_reschedule_notice",
  "therapist_cancellation_notice",
  "therapist_account_invitation",
  "booking_reminder_24h",
  "booking_reminder_1h",
  "reschedule_notice",
  "cancellation_notice",
  "contact_ack",
  "contact_admin_notice",
  "form_reminder",
  "payment_success",
  "payment_failed",
  "bank_transfer_received",
  "package_booking_link",
  "password_reset",
]);

export type PreviewTemplateKey = z.infer<typeof templateKeySchema>;

const previewInput = z.object({ templateKey: templateKeySchema });

function sampleDataFor(key: PreviewTemplateKey): Record<string, unknown> {
  const startsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
  const manageUrl = `${(process.env.SITE_URL ?? "https://talkspace.ng").replace(/\/$/, "")}/manage/TS-SAMPLE1?token=sample-manage-token-preview-only`;
  const base = {
    clientName: "Ada Okoro",
    reference: "TS-SAMPLE1",
    serviceName: "Individual Therapy (60 min)",
    therapistName: "Dr. Chinwe Adamu",
    startsAt,
    mode: "online",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    manageUrl,
  };
  switch (key) {
    case "booking_admin_notice":
      return {
        ...base,
        clientEmail: "ada.okoro@example.com",
        clientPhone: "+234 803 000 0000",
        status: "held",
        paymentStatus: "Pending payment/confirmation",
        notes: "I would prefer an evening appointment if possible.",
        adminUrl: `${(process.env.SITE_URL ?? "https://talkspace.ng").replace(/\/$/, "")}/admin/bookings`,
      };
    case "therapist_booking_notice":
    case "therapist_reschedule_notice":
    case "therapist_cancellation_notice":
      return {
        ...base,
        clientEmail: "ada.okoro@example.com",
        clientPhone: "+234 803 000 0000",
      };
    case "therapist_account_invitation":
      return {
        therapistName: base.therapistName,
        invitationUrl: `${(process.env.SITE_URL ?? "https://talkspace.ng").replace(/\/$/, "")}/reset-password?token=sample-invitation-token-preview-only`,
      };
    case "contact_ack":
      return {
        clientName: base.clientName,
        message:
          "Hi, I'd like to book a session for next week. Could you let me know availability?",
      };
    case "contact_admin_notice":
      return {
        clientName: base.clientName,
        email: "ada.okoro@example.com",
        phone: "+234 803 000 0000",
        source: "contact_page",
        message: "Hi, I'd like to book a session for next week.",
      };
    case "password_reset":
      return {
        clientName: base.clientName,
        resetUrl: `${(process.env.SITE_URL ?? "https://talkspace.ng").replace(/\/$/, "")}/reset-password?token=sample-preview-token`,
      };
    case "form_reminder":
      return {
        clientName: base.clientName,
        formName: "booking intake",
        resumeUrl: `${(process.env.SITE_URL ?? "https://talkspace.ng").replace(/\/$/, "")}/book`,
      };
    case "payment_success":
    case "payment_failed":
    case "bank_transfer_received":
      return {
        ...base,
        paymentReference: "TSP-DEMO-001",
        bookingReference: base.reference,
        amountKobo: 4500000,
        currency: "NGN",
        paymentMethod: key === "bank_transfer_received" ? "Bank transfer" : "Paystack",
      };
    case "package_booking_link":
      return {
        ...base,
        packageBookingUrl: `${(process.env.SITE_URL ?? "https://talkspace.ng").replace(/\/$/, "")}/book?package=sample-package-token-preview-only`,
        purchasedSessions: 4,
        remainingSessions: 3,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };
    default:
      return base;
  }
}

const formReminderInput = z.object({ submissionId: z.string().uuid() });

export const sendIntakeFormReminder = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof formReminderInput>) => formReminderInput.parse(data))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email.server");
    const { canonicalUrl } = await import("@/lib/seo");

    const { data: submission, error } = await supabaseAdmin
      .from("intake_submissions")
      .select("id, source, template_key, subject_name, subject_email, completion_state, payload")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw error;
    if (!submission) throw new Error("Pending form not found.");
    if (submission.source === "booking") {
      throw new Error(
        "Incomplete-booking reminders are disabled until timing and copy are approved.",
      );
    }
    if (!["draft", "in_progress"].includes(String(submission.completion_state))) {
      throw new Error("This form is already completed.");
    }
    const recipient = String(submission.subject_email ?? "").trim();
    if (!recipient) throw new Error("Add a client email before sending a reminder.");

    const payload =
      submission.payload && typeof submission.payload === "object"
        ? (submission.payload as Record<string, unknown>)
        : {};
    const requestedPath = typeof payload.resumePath === "string" ? payload.resumePath.trim() : "";
    const defaultPath =
      submission.source === "booking" ? "/book" : submission.source === "contact" ? "/contact" : "";
    const resumePath =
      requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : defaultPath;
    if (!resumePath) {
      throw new Error("This assessment does not have a client completion link yet.");
    }

    const formName = String(submission.template_key ?? "form")
      .replace(/_v\d+$/, "")
      .replace(/_/g, " ");
    const result = await sendTemplateEmail("form_reminder", recipient, {
      intakeSubmissionId: submission.id,
      clientName: submission.subject_name ?? "there",
      formName,
      resumeUrl: canonicalUrl(resumePath),
    });
    if (!result.sent) throw new Error(`Reminder was not sent: ${result.reason}.`);

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("intake_submissions")
      .update({ reminder_sent_at: sentAt, reminder_sent_by: userId })
      .eq("id", data.submissionId)
      .in("completion_state", ["draft", "in_progress"]);
    if (updateError) throw updateError;
    return { ok: true, sentAt };
  });

export const previewEmailTemplate = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof previewInput>) => previewInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { renderEmailTemplate } = await import("@/lib/email-templates.server");
    const { loadTemplateSettings } = await import("@/lib/email.server");
    const settings = (await loadTemplateSettings()) as EmailTemplateDTO[];
    const template = settings.find((s) => s.templateKey === data.templateKey);
    const rendered = renderEmailTemplate(
      data.templateKey,
      sampleDataFor(data.templateKey),
      template?.bodyOverride,
    );
    const override = template?.subjectOverride;
    noStore();
    return {
      templateKey: data.templateKey,
      subject: override?.trim() || rendered.subject,
      defaultSubject: rendered.subject,
      overrideSubject: override?.trim() || null,
      html: rendered.html,
    };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof testInput>) => testInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { sendRawEmail } = await import("@/lib/email.server");
    const { renderEmailTemplate } = await import("@/lib/email-templates.server");
    const rendered = renderEmailTemplate("booking_confirmation", {
      clientName: "Talk Space Admin",
      reference: "TS-TEST-0001",
      serviceName: "Test service",
      therapistName: "Talk Space team",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      mode: "online",
      meetingLink: "https://meet.google.com/abc-defg-hij",
    });
    const result = await sendRawEmail({
      to: data.to,
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
    });
    return result;
  });

export type ContactSubmissionRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  message: string;
  source: string;
  createdAt: string;
  ackSentAt: string | null;
  adminNotifiedAt: string | null;
  deliveryError: string | null;
};

export const listContactSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("contact_submissions")
    .select(
      "id, full_name, email, phone, message, source, created_at, ack_sent_at, admin_notified_at, delivery_error",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  noStore();
  return (data ?? []).map((row): ContactSubmissionRow => ({
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: (row.phone as string | null) ?? null,
    message: row.message as string,
    source: (row.source as string) ?? "contact_page",
    createdAt: row.created_at as string,
    ackSentAt: (row.ack_sent_at as string | null) ?? null,
    adminNotifiedAt: (row.admin_notified_at as string | null) ?? null,
    deliveryError: (row.delivery_error as string | null) ?? null,
  }));
});

export const deleteContactSubmission = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_submissions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export type EmailLogRow = {
  id: string;
  templateKey: string | null;
  recipient: string;
  subject: string | null;
  status: "sent" | "failed" | "skipped";
  reason: string | null;
  providerId: string | null;
  error: string | null;
  createdAt: string;
  retryCount: number;
  nextRetryAt: string | null;
  retriedFrom: string | null;
  retryTrigger: "initial" | "automatic" | "manual";
  canRetry: boolean;
};

async function loadEmailDeliveryLogs(): Promise<EmailLogRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_delivery_logs")
    .select(
      "id, template_key, recipient, subject, status, reason, provider_id, error, created_at, retry_count, next_retry_at, retried_from, retry_trigger",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const retryableIds = new Set<string>();
  const failedIds = (data ?? [])
    .filter((row) => row.status === "failed")
    .map((row) => row.id as string);
  if (failedIds.length) {
    const { data: retryable, error: retryableError } = await supabaseAdmin
      .from("email_delivery_logs")
      .select("id")
      .in("id", failedIds)
      .not("retry_payload_ciphertext", "is", null);
    if (retryableError) throw retryableError;
    for (const row of retryable ?? []) retryableIds.add(row.id as string);
  }

  return (data ?? []).map((row): EmailLogRow => ({
    id: row.id as string,
    templateKey: (row.template_key as string | null) ?? null,
    recipient: row.recipient as string,
    subject: (row.subject as string | null) ?? null,
    status: row.status as "sent" | "failed" | "skipped",
    reason: (row.reason as string | null) ?? null,
    providerId: (row.provider_id as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    retryCount: Number(row.retry_count ?? 0),
    nextRetryAt: (row.next_retry_at as string | null) ?? null,
    retriedFrom: (row.retried_from as string | null) ?? null,
    retryTrigger: (row.retry_trigger as "initial" | "automatic" | "manual") ?? "initial",
    canRetry: retryableIds.has(row.id as string),
  }));
}

export const listEmailDeliveryLogs = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const logs = await loadEmailDeliveryLogs();
  noStore();
  return logs;
});

export const retryEmailDeliveryLog = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { retryLoggedEmail } = await import("@/lib/email.server");
    const result = await retryLoggedEmail(data.id, { trigger: "manual", actorId: userId });
    if (!result.sent) throw new Error(result.reason || "The email retry failed.");
    return { ok: true, logId: result.logId };
  });

export const deleteEmailDeliveryLog = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_delivery_logs").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export type ReminderSettingsDTO = {
  reminder24hOpenMinMinutes: number;
  reminder24hOpenMaxMinutes: number;
  reminder1hOpenMinMinutes: number;
  reminder1hOpenMaxMinutes: number;
  updatedAt: string;
};

async function loadReminderSettings(): Promise<ReminderSettingsDTO> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("reminder_settings")
    .select(
      "reminder_24h_open_min_minutes, reminder_24h_open_max_minutes, reminder_1h_open_min_minutes, reminder_1h_open_max_minutes, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    reminder24hOpenMinMinutes: (data?.reminder_24h_open_min_minutes as number) ?? 1380,
    reminder24hOpenMaxMinutes: (data?.reminder_24h_open_max_minutes as number) ?? 1470,
    reminder1hOpenMinMinutes: (data?.reminder_1h_open_min_minutes as number) ?? 30,
    reminder1hOpenMaxMinutes: (data?.reminder_1h_open_max_minutes as number) ?? 90,
    updatedAt: (data?.updated_at as string) ?? new Date().toISOString(),
  };
}

export const getReminderSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReminderSettingsDTO> => {
    await requireAdmin();
    const settings = await loadReminderSettings();
    noStore();
    return settings;
  },
);

export type EmailAdminWorkspace = {
  settings: EmailSettingsDTO;
  templates: EmailTemplateDTO[];
  logs: EmailLogRow[];
  reminder: ReminderSettingsDTO;
};

export const getEmailAdminWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<EmailAdminWorkspace> => {
    await requireAdmin();
    const [admin, logs, reminder] = await Promise.all([
      loadEmailAdminData(),
      loadEmailDeliveryLogs(),
      loadReminderSettings(),
    ]);
    noStore();
    return { ...admin, logs, reminder };
  },
);

const reminderInput = z
  .object({
    reminder24hOpenMinMinutes: z.number().int().min(1).max(10080),
    reminder24hOpenMaxMinutes: z.number().int().min(1).max(10080),
    reminder1hOpenMinMinutes: z.number().int().min(1).max(10080),
    reminder1hOpenMaxMinutes: z.number().int().min(1).max(10080),
  })
  .refine((d) => d.reminder24hOpenMaxMinutes > d.reminder24hOpenMinMinutes, {
    message: "24h max must be greater than min",
    path: ["reminder24hOpenMaxMinutes"],
  })
  .refine((d) => d.reminder1hOpenMaxMinutes > d.reminder1hOpenMinMinutes, {
    message: "1h max must be greater than min",
    path: ["reminder1hOpenMaxMinutes"],
  });

export const updateReminderSettings = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof reminderInput>) => reminderInput.parse(data))
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reminder_settings").upsert({
      id: 1,
      reminder_24h_open_min_minutes: data.reminder24hOpenMinMinutes,
      reminder_24h_open_max_minutes: data.reminder24hOpenMaxMinutes,
      reminder_1h_open_min_minutes: data.reminder1hOpenMinMinutes,
      reminder_1h_open_max_minutes: data.reminder1hOpenMaxMinutes,
      updated_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });
