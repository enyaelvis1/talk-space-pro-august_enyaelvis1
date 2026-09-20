import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplateEmail } from "@/lib/email.server";
import type { EmailTemplateKey } from "@/lib/email-templates.server";
import { canonicalUrl } from "@/lib/seo";
import { readPaymentReceipt } from "@/lib/payment-validation";

type PaymentTemplateKey = Extract<
  EmailTemplateKey,
  "payment_success" | "payment_failed" | "bank_transfer_received"
>;

const CLAIM_COLUMNS = {
  payment_success: "payment_success_email_claimed_at",
  payment_failed: "payment_failed_email_claimed_at",
  bank_transfer_received: "bank_transfer_received_email_claimed_at",
} as const;

function activeManagePath(appointment: {
  booking_reference?: string;
  manage_token?: string | null;
  manage_token_expires_at?: string | null;
  manage_token_revoked_at?: string | null;
  status?: string | null;
}) {
  const reference = appointment.booking_reference ?? "";
  const active =
    appointment.manage_token &&
    !appointment.manage_token_revoked_at &&
    (!appointment.manage_token_expires_at ||
      Date.parse(appointment.manage_token_expires_at) > Date.now()) &&
    !["cancelled", "completed", "no_show"].includes(String(appointment.status ?? ""));
  return active ? `/manage/${reference}?token=${appointment.manage_token}` : `/manage/${reference}`;
}

export async function sendPaymentEmail(params: {
  paymentId?: string;
  reference?: string;
  templateKey: PaymentTemplateKey;
}) {
  let query = supabaseAdmin
    .from("payments")
    .select(
      "id, provider, reference, amount_kobo, currency, status, metadata, payment_success_email_claimed_at, payment_failed_email_claimed_at, payment_review_email_claimed_at, bank_transfer_received_email_claimed_at, appointments(client_email, client_name, booking_reference, starts_at, session_mode, google_meet_url, status, manage_token, manage_token_expires_at, manage_token_revoked_at, services(name), therapists(full_name, location))",
    );
  query = params.paymentId
    ? query.eq("id", params.paymentId)
    : query.eq("reference", params.reference!);
  const { data: payment, error } = await query.maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error("Payment not found for email delivery.");
  const expectedStatus =
    params.templateKey === "payment_success"
      ? "succeeded"
      : params.templateKey === "payment_failed"
        ? "failed"
        : "awaiting_confirmation";
  if (payment.status !== expectedStatus) {
    return { sent: false as const, reason: "payment_state_changed", logId: null };
  }

  const appointment = payment.appointments as {
    client_email?: string;
    client_name?: string;
    booking_reference?: string;
    starts_at?: string;
    session_mode?: string;
    google_meet_url?: string | null;
    manage_token?: string | null;
    manage_token_expires_at?: string | null;
    manage_token_revoked_at?: string | null;
    status?: string | null;
    services?: { name?: string } | null;
    therapists?: { full_name?: string; location?: string | null } | null;
  } | null;
  if (!appointment?.client_email) throw new Error("Payment client email is missing.");

  const needsReview =
    params.templateKey === "payment_success" &&
    typeof payment.metadata === "object" &&
    payment.metadata !== null &&
    !Array.isArray(payment.metadata) &&
    payment.metadata.booking_review_required === true;
  if (
    params.templateKey === "payment_success" &&
    !needsReview &&
    !["confirmed", "completed", "no_show"].includes(appointment.status ?? "")
  ) {
    return { sent: false as const, reason: "booking_not_confirmed", logId: null };
  }
  const claimColumn = needsReview
    ? "payment_review_email_claimed_at"
    : CLAIM_COLUMNS[params.templateKey];
  if (payment[claimColumn]) {
    return { sent: false as const, reason: "already_notified", logId: null };
  }

  // Callback, webhook, and delayed reconciliation can race. Only the process
  // that changes this null marker may initiate the customer notification.
  const claimTimestamp = new Date().toISOString();
  const claimUpdate =
    claimColumn === "payment_review_email_claimed_at"
      ? { payment_review_email_claimed_at: claimTimestamp }
      : claimColumn === "payment_success_email_claimed_at"
        ? { payment_success_email_claimed_at: claimTimestamp }
        : claimColumn === "payment_failed_email_claimed_at"
          ? { payment_failed_email_claimed_at: claimTimestamp }
          : { bank_transfer_received_email_claimed_at: claimTimestamp };
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("payments")
    .update(claimUpdate)
    .eq("id", payment.id)
    .is(claimColumn, null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { sent: false as const, reason: "already_notified", logId: null };

  const bookingNeedsReview =
    params.templateKey === "payment_success" &&
    !["confirmed", "completed", "no_show"].includes(appointment.status ?? "");
  const packageInfo =
    params.templateKey === "payment_success" && !bookingNeedsReview
      ? await (async () => {
          try {
            const { ensureSessionPackageForPayment } =
              await import("@/lib/session-packages.server");
            return await ensureSessionPackageForPayment(payment.id as string);
          } catch (err) {
            console.error("[payments] package activation failed:", err);
            return null;
          }
        })()
      : null;

  const receipt =
    payment.provider === "paystack" && params.templateKey === "payment_success"
      ? readPaymentReceipt(payment.metadata)
      : null;
  const result = await sendTemplateEmail(params.templateKey, appointment.client_email, {
    clientName: appointment.client_name,
    bookingNeedsReview: bookingNeedsReview ? "yes" : "",
    paymentReference: payment.reference,
    bookingReference: appointment.booking_reference,
    amountKobo: payment.amount_kobo,
    checkoutPaidKobo: receipt?.amountKobo ?? "",
    checkoutFeeKobo: receipt?.customerFeeKobo ?? "",
    currency: payment.currency ?? "NGN",
    paymentMethod: payment.provider === "bank_transfer" ? "Bank transfer" : "Paystack",
    serviceName: appointment.services?.name ?? "",
    therapistName: appointment.therapists?.full_name ?? "",
    startsAt: appointment.starts_at,
    mode: appointment.session_mode,
    meetingLink: appointment.google_meet_url ?? "",
    location: (appointment.therapists as { location?: string | null } | null)?.location ?? "",
    manageUrl: canonicalUrl(activeManagePath(appointment)),
    packageBookingUrl: packageInfo?.bookingUrl ?? "",
    packagePurchasedSessions: packageInfo?.purchasedSessions ?? "",
    packageRemainingSessions: packageInfo?.remainingSessions ?? "",
  });

  // Provider failures have an encrypted retry queued. Configuration skips do
  // not, so release their claim to allow delivery after the settings are fixed.
  const configurationSkips = new Set([
    "emails_disabled",
    "from_email_not_configured",
    "template_disabled",
    "api_key_not_configured",
  ]);
  if (!result.sent && configurationSkips.has(result.reason)) {
    const releaseUpdate =
      claimColumn === "payment_review_email_claimed_at"
        ? { payment_review_email_claimed_at: null }
        : claimColumn === "payment_success_email_claimed_at"
          ? { payment_success_email_claimed_at: null }
          : claimColumn === "payment_failed_email_claimed_at"
            ? { payment_failed_email_claimed_at: null }
            : { bank_transfer_received_email_claimed_at: null };
    const { error: releaseError } = await supabaseAdmin
      .from("payments")
      .update(releaseUpdate)
      .eq("id", payment.id);
    if (releaseError) console.error("[email] failed to release payment email claim", releaseError);
  }

  return result;
}
