import { createFileRoute } from "@tanstack/react-router";

import { verifyCronRequest } from "@/lib/cron-auth";
import { canonicalUrl } from "@/lib/seo";

type ReminderKey = "booking_reminder_24h" | "booking_reminder_1h";

type AppointmentRow = {
  id: string;
  booking_reference: string;
  client_name: string;
  client_email: string;
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
      "id, booking_reference, client_name, client_email, starts_at, session_mode, google_meet_url, status, reminder_24h_sent_at, reminder_1h_sent_at, manage_token, manage_token_expires_at, manage_token_revoked_at, services(name), therapists(full_name)",
    )
    .eq("status", "confirmed")
    .is("archived_at", null)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);

  if (error) throw error;

  const rows = (data ?? []) as unknown as AppointmentRow[];
  const results: Array<{ id: string; key: ReminderKey; sent: boolean; reason?: string }> = [];

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
      try {
        const result = await sendTemplateEmail(key, row.client_email, {
          clientName: row.client_name,
          reference: row.booking_reference,
          serviceName: row.services?.name ?? "",
          therapistName: row.therapists?.full_name ?? "",
          startsAt: row.starts_at,
          mode: row.session_mode,
          meetingLink: row.google_meet_url ?? "",
          manageUrl: canonicalUrl(activeManagePath(row)),
        });

        if (result.sent) {
          const stamp = new Date().toISOString();
          const patch =
            key === "booking_reminder_24h"
              ? { reminder_24h_sent_at: stamp }
              : { reminder_1h_sent_at: stamp };
          await supabaseAdmin.from("appointments").update(patch).eq("id", row.id);
          results.push({ id: row.id, key, sent: true });
        } else {
          results.push({ id: row.id, key, sent: false, reason: result.reason });
          // If emails are globally disabled or template disabled, no point retrying every run —
          // stamp the row so we don't loop on it, unless the failure is transient.
          if (result.reason === "emails_disabled" || result.reason === "template_disabled") {
            const stamp = new Date().toISOString();
            const patch =
              key === "booking_reminder_24h"
                ? { reminder_24h_sent_at: stamp }
                : { reminder_1h_sent_at: stamp };
            await supabaseAdmin.from("appointments").update(patch).eq("id", row.id);
          }
        }
      } catch (err) {
        console.error(`[reminders] failed for ${row.id}/${key}:`, err);
        results.push({
          id: row.id,
          key,
          sent: false,
          reason: err instanceof Error ? err.message : "unknown",
        });
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
