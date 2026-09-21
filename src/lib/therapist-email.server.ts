import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplateEmail } from "@/lib/email.server";
import type { EmailTemplateKey } from "@/lib/email-templates.server";
import { canonicalUrl } from "@/lib/seo";

export async function sendTherapistBookingEmail(appointmentId: string) {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, booking_reference, client_name, client_email, client_phone, starts_at, session_mode, status, google_meet_url, services(name), therapists(full_name, user_id, location)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!appointment) return { sent: false as const, reason: "appointment_not_found" };
  if (appointment.status !== "confirmed") {
    return { sent: false as const, reason: "booking_not_committed" };
  }

  const therapist = appointment.therapists as {
    full_name?: string;
    user_id?: string | null;
    location?: string | null;
  } | null;
  if (!therapist?.user_id) {
    console.warn("[email] therapist booking notice skipped: therapist login is not linked", {
      appointmentId,
    });
    return { sent: false as const, reason: "therapist_login_not_linked" };
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
    therapist.user_id,
  );
  if (authError) throw authError;
  const recipient = authUser.user?.email?.trim().toLowerCase();
  if (!recipient) {
    console.warn("[email] therapist booking notice skipped: therapist email is missing", {
      appointmentId,
      therapistId: therapist.user_id,
    });
    return { sent: false as const, reason: "therapist_email_missing" };
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("appointments")
    .update({ therapist_notification_claimed_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("status", "confirmed")
    .is("therapist_notification_claimed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { sent: false as const, reason: "already_notified" };

  const result = await sendTemplateEmail("therapist_booking_notice", recipient, {
    reference: appointment.booking_reference,
    clientName: appointment.client_name,
    clientEmail: appointment.client_email,
    clientPhone: appointment.client_phone,
    therapistName: therapist.full_name ?? "Therapist",
    serviceName: (appointment.services as { name?: string } | null)?.name ?? "Session",
    startsAt: appointment.starts_at,
    mode: appointment.session_mode,
    meetingLink: appointment.google_meet_url ?? "",
    location: therapist.location ?? "",
    adminUrl: canonicalUrl("/therapist"),
  });

  if (
    !result.sent &&
    [
      "emails_disabled",
      "from_email_not_configured",
      "template_disabled",
      "api_key_not_configured",
    ].includes(result.reason ?? "")
  ) {
    const { error: releaseError } = await supabaseAdmin
      .from("appointments")
      .update({ therapist_notification_claimed_at: null })
      .eq("id", appointmentId);
    if (releaseError)
      console.error("[email] failed to release therapist email claim", releaseError);
  }
  return result;
}

type TherapistLifecycleTemplate = "therapist_reschedule_notice" | "therapist_cancellation_notice";

/**
 * Send a therapist lifecycle notice with the same atomic claim semantics as
 * client lifecycle notices. The claim key is scoped to the appointment and
 * recipient role, so retries cannot send a second notice.
 */
export async function sendTherapistLifecycleEmail(
  appointmentId: string,
  templateKey: TherapistLifecycleTemplate,
  data: Record<string, unknown>,
) {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("therapists(full_name, user_id)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  const therapist = appointment?.therapists as {
    full_name?: string;
    user_id?: string | null;
  } | null;
  if (!therapist?.user_id) return { sent: false as const, reason: "therapist_login_not_linked" };

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
    therapist.user_id,
  );
  if (authError) throw authError;
  const recipient = authUser.user?.email?.trim().toLowerCase();
  if (!recipient) return { sent: false as const, reason: "therapist_email_missing" };

  const rpcClient = supabaseAdmin as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null; error: Error | null }>;
  };
  const { data: claimed, error: claimError } = await rpcClient.rpc(
    "claim_appointment_notification",
    {
      p_appointment_id: appointmentId,
      p_notification_key: templateKey,
      p_recipient_role: "therapist",
    },
  );
  if (claimError) throw claimError;
  if (!claimed) return { sent: false as const, reason: "already_notified" };

  try {
    const result = await sendTemplateEmail(templateKey as EmailTemplateKey, recipient, {
      ...data,
      therapistName: data.therapistName ?? therapist.full_name ?? "Therapist",
    });
    const { error: finalizeError } = await rpcClient.rpc("finalize_appointment_notification", {
      p_appointment_id: appointmentId,
      p_notification_key: templateKey,
      p_recipient_role: "therapist",
      p_sent: result.sent,
    });
    if (finalizeError) throw finalizeError;
    return result;
  } catch (sendError) {
    await rpcClient.rpc("finalize_appointment_notification", {
      p_appointment_id: appointmentId,
      p_notification_key: templateKey,
      p_recipient_role: "therapist",
      p_sent: false,
    });
    throw sendError;
  }
}
