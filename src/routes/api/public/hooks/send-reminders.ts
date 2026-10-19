import { createFileRoute } from "@tanstack/react-router";

import { verifyCronRequest } from "@/lib/cron-auth";
import { canonicalUrl } from "@/lib/seo";

type ReminderKey = "booking_reminder_24h" | "booking_reminder_1h";

type AppointmentRow = {
  id: string;
  booking_reference: string;
  client_name: string;
  client_email: string;
  partner_name: string | null;
  partner_email: string | null;
  starts_at: string;
  session_mode: string;
  google_meet_url: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  manage_token: string | null;
  manage_token_expires_at: string | null;
  manage_token_revoked_at: string | null;
  status: string;
  services: { name: string | null } | null;
  therapists: { full_name: string | null } | null;
};

function activeManagePath(row: AppointmentRow) {
  const active =
    row.manage_token &&
    !row.manage_token_revoked_at &&
    (!row.manage_token_expires_at || Date.parse(row.manage_token_expires_at) > Date.now()) &&
    !["cancelled", "completed", "no_show"].includes(row.status);
  return active
    ? `/manage/${row.booking_reference}?token=${row.manage_token}`
    : `/manage/${row.booking_reference}`;
}

async function sendReminderRecipient(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  sendTemplateEmail: typeof import("@/lib/email.server").sendTemplateEmail,
  row: AppointmentRow,
  key: ReminderKey,
  recipient: "client" | "partner",
): Promise<import("@/lib/email.server").SendResult | { sent: false; reason: "no_recipient" }> {
  const email = recipient === "client" ? row.client_email : row.partner_email;
  if (!email) return { sent: false, reason: "no_recipient" };
  const notificationKey = recipient === "client" ? key : `${key}:partner`;
  const claim = await supabaseAdmin.rpc("claim_appointment_notification", {
    p_appointment_id: row.id,
    p_notification_key: notificationKey,
    p_recipient_role: recipient,
  });
  if (claim.error) throw claim.error;
  if (!claim.data) return { sent: false as const, reason: "notification_claimed", logId: null };

  let result: import("@/lib/email.server").SendResult;
  try {
    result = await sendTemplateEmail(key, email, {
      clientName: recipient === "client" ? row.client_name : row.partner_name || "there",
      reference: row.booking_reference,
      serviceName: row.services?.name ?? "",
      therapistName: row.therapists?.full_name ?? "",
      startsAt: row.starts_at,
      mode: row.session_mode,
      meetingLink: row.google_meet_url ?? "",
      manageUrl: canonicalUrl(activeManagePath(row)),
    });
  } catch (error) {
    await supabaseAdmin.rpc("finalize_appointment_notification", {
      p_appointment_id: row.id,
      p_notification_key: notificationKey,
      p_recipient_role: recipient,
      p_sent: false,
    });
    throw error;
  }

  const finalize = await supabaseAdmin.rpc("finalize_appointment_notification", {
    p_appointment_id: row.id,
    p_notification_key: notificationKey,
    p_recipient_role: recipient,
    p_sent: result.sent,
  });
  if (finalize.error) throw finalize.error;
  const resultReason = "reason" in result ? result.reason : undefined;

  if (
    recipient === "client" &&
    (!result.sent || resultReason === "emails_disabled" || resultReason === "template_disabled")
  ) {
    const stamp = new Date().toISOString();
    const patch =
      key === "booking_reminder_24h"
        ? { reminder_24h_sent_at: stamp }
        : { reminder_1h_sent_at: stamp };
    if (result.sent || resultReason === "emails_disabled" || resultReason === "template_disabled") {
      await supabaseAdmin.from("appointments").update(patch).eq("id", row.id);
    }
  }
  return result;
}

async function processReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("@/lib/email.server");

  const now = Date.now();

  // Admin-configurable reminder windows (minutes before the appointment start).
  const { data: settingsRow } = await supabaseAdmin
    .from("reminder_settings")
    .select(
      "reminder_24h_open_min_minutes, reminder_24h_open_max_minutes, reminder_1h_open_min_minutes, reminder_1h_open_max_minutes",
    )
    .eq("id", 1)
    .maybeSingle();

  const win24Min = (settingsRow?.reminder_24h_open_min_minutes as number) ?? 1380;
  const win24Max = (settingsRow?.reminder_24h_open_max_minutes as number) ?? 1470;
  const win1Min = (settingsRow?.reminder_1h_open_min_minutes as number) ?? 30;
  const win1Max = (settingsRow?.reminder_1h_open_max_minutes as number) ?? 90;

  // Look ahead to the largest configured window so we cover both reminders in one query.
  const lookaheadMinutes = Math.max(win24Max, win1Max) + 5;
  const windowEnd = new Date(now + lookaheadMinutes * 60 * 1000).toISOString();
  const windowStart = new Date(now - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, booking_reference, client_name, client_email, partner_name, partner_email, starts_at, session_mode, google_meet_url, status, reminder_24h_sent_at, reminder_1h_sent_at, manage_token, manage_token_expires_at, manage_token_revoked_at, services(name), therapists(full_name)",
    )
    .eq("status", "confirmed")
    .is("archived_at", null)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .order("starts_at", { ascending: true })
    .limit(100);

  if (error) throw error;

  const rows = (data ?? []) as unknown as AppointmentRow[];
  const results: Array<{
    id: string;
    key: ReminderKey;
    recipient: "client" | "partner";
    sent: boolean;
    reason?: string;
  }> = [];

  for (const row of rows) {
    const startsMs = new Date(row.starts_at).getTime();
    const minutesUntil = (startsMs - now) / 60000;

    const due24h =
      !row.reminder_24h_sent_at && minutesUntil >= win24Min && minutesUntil <= win24Max;
    const due1h = !row.reminder_1h_sent_at && minutesUntil >= win1Min && minutesUntil <= win1Max;

    const toSend: ReminderKey[] = [];
    if (due24h) toSend.push("booking_reminder_24h");
    if (due1h) toSend.push("booking_reminder_1h");
    if (toSend.length === 0) continue;

    for (const key of toSend) {
      for (const recipient of ["client", "partner"] as const) {
        if (recipient === "partner" && !row.partner_email) continue;
        try {
          const result = await sendReminderRecipient(
            supabaseAdmin,
            sendTemplateEmail,
            row,
            key,
            recipient,
          );
          results.push({
            id: row.id,
            key,
            recipient,
            sent: result.sent,
            reason: result.sent ? undefined : result.reason,
          });
        } catch (err) {
          console.error(`[reminders] ${recipient} failed for ${row.id}/${key}:`, err);
          results.push({
            id: row.id,
            key,
            recipient,
            sent: false,
            reason: err instanceof Error ? err.message : "unknown",
          });
        }
      }
    }
  }

  return { scanned: rows.length, results };
}

async function handleReminderRequest(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const summary = await processReminders();
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[reminders] job failed:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: ({ request }) => handleReminderRequest(request),
      GET: ({ request }) => handleReminderRequest(request),
    },
  },
});
