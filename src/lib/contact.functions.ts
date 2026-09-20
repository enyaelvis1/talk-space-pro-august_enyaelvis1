import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { createRequestSupabase } from "@/lib/supabase-server";
import { buildIntakeConsentSnapshot } from "@/lib/intake-consent";
import { getTemplateVersion } from "@/lib/form-templates";
import { guardPublicRequest } from "@/lib/rate-limit.server";

const contactInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/)
    .optional()
    .or(z.literal("")),
  message: z.string().trim().min(10).max(2000),
  templateKey: z.string().trim().min(1).max(120).optional(),
  consentAcknowledged: z.literal(true),
  // Honeypot: real users leave this empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export const submitContactMessage = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof contactInput>) => contactInput.parse(data))
  .handler(async ({ data }) => {
    if (data.website && data.website.length > 0) {
      // Silently pretend success for bots.
      return { ok: true };
    }

    const req = getRequest();
    // Shared limiter (in addition to the per-IP submission count below) so
    // repeated failures are also throttled, not just successful inserts.
    await guardPublicRequest({
      request: req,
      bucket: "contact_submit",
      limit: 8,
      windowSeconds: 60 * 60,
      route: "/contact",
      action: "message",
    });

    const requestSupabase = createRequestSupabase(req);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;
    let userId: string | null = null;
    if (requestSupabase) {
      const { data } = await requestSupabase.client.auth.getUser();
      userId = data.user?.id ?? null;
      requestSupabase.commitCookies();
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const consent = buildIntakeConsentSnapshot("/contact");
    const templateVersion = getTemplateVersion(data.templateKey ?? "contact_enquiry_v1");

    // Basic throttle: at most 5 submissions per hour per IP hash.
    if (ipHash) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", oneHourAgo);
      if ((count ?? 0) >= 5) {
        throw new Error("Too many messages from this device. Please try again later.");
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("contact_submissions")
      .insert({
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        message: data.message,
        source: "contact_page",
        ip_hash: ipHash,
      })
      .select("id")
      .single();
    if (error) throw error;

    const submissionId = inserted.id as string;
    const { error: intakeError } = await supabaseAdmin.from("intake_submissions").insert({
      source: "contact",
      template_key: data.templateKey ?? "contact_enquiry_v1",
      template_version: templateVersion,
      completion_state: "completed",
      consent_acknowledged_at: consent.acknowledgedAt,
      client_id: userId,
      contact_submission_id: submissionId,
      subject_name: data.fullName,
      subject_email: data.email.toLowerCase(),
      payload: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        message: data.message,
        consent,
      },
      completed_at: new Date().toISOString(),
    });
    if (intakeError) {
      console.error("[contact] intake snapshot insert failed:", intakeError);
    }

    // Fire-and-await both sends, but never break the form flow on send failure.
    const { sendTemplateEmail, loadEmailSettings } = await import("@/lib/email.server");
    const settings = await loadEmailSettings();

    const ackResult = await sendTemplateEmail("contact_ack", data.email, {
      clientName: data.fullName,
      message: data.message,
    });

    const inbox = settings.zohoRoutingEnabled
      ? settings.contactInbox
      : settings.contactInbox || settings.fromEmail;
    let adminResult: { sent: boolean; reason?: string } = { sent: false, reason: "no_inbox" };
    if (inbox) {
      adminResult = await sendTemplateEmail("contact_admin_notice", inbox, {
        clientName: data.fullName,
        email: data.email,
        phone: data.phone,
        message: data.message,
        source: "contact_page",
        routingProvider: settings.zohoRoutingEnabled ? "zoho_mail" : "configured_inbox",
      });
    }

    await supabaseAdmin
      .from("contact_submissions")
      .update({
        ack_sent_at: ackResult.sent ? new Date().toISOString() : null,
        admin_notified_at: adminResult.sent ? new Date().toISOString() : null,
        delivery_error:
          !ackResult.sent || !adminResult.sent
            ? JSON.stringify({
                ack: ackResult.sent ? null : (ackResult as { reason?: string }).reason,
                admin: adminResult.sent ? null : adminResult.reason,
              })
            : null,
      })
      .eq("id", submissionId);

    setResponseHeader("Cache-Control", "private, no-store");
    return { ok: true };
  });
