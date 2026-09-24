import { createFileRoute } from "@tanstack/react-router";

import { verifyCronRequest } from "@/lib/cron-auth";

import {
  isRecheckablePaymentStatus,
  validateProviderPayment,
  paymentReceipt,
} from "@/lib/payment-validation";

async function recheckPayments(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const { processDueEmailRetries } = await import("@/lib/email.server");
  const emailRetries = await processDueEmailRetries();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: expiryError } = await supabaseAdmin.rpc("expire_stale_holds");
  if (expiryError) throw expiryError;
  const { loadPaystackSecret, paystackVerify } = await import("@/lib/payments.server");
  const { loadPaystackCheckout } = await import("@/lib/paystack-checkout.server");
  const secret = await loadPaystackSecret();
  if (!secret) {
    return Response.json({
      ok: true,
      scanned: 0,
      reason: "paystack_not_configured",
      emailRetries,
    });
  }

  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select("reference, checkout_group_reference")
    .eq("provider", "paystack")
    .eq("status", "initiated")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  const results: Array<{ reference: string; status: string }> = [];
  const checked = new Set<string>();
  for (const payment of payments ?? []) {
    if (!isRecheckablePaymentStatus("initiated")) continue;
    const reference = payment.checkout_group_reference ?? payment.reference;
    if (checked.has(reference)) continue;
    checked.add(reference);
    try {
      const checkout = await loadPaystackCheckout(reference);
      if (checkout.alreadySucceeded) continue;
      const verified = await paystackVerify({ secretKey: secret, reference });
      validateProviderPayment({
        expectedAmountKobo: checkout.amountKobo,
        expectedCurrency: checkout.currency,
        expectedReference: reference,
        result: verified,
      });
      const nextStatus =
        verified.status === "success"
          ? "succeeded"
          : verified.status === "failed" || verified.status === "abandoned"
            ? "failed"
            : "initiated";
      if (nextStatus !== "initiated") {
        if (nextStatus === "succeeded") {
          const { assertPaymentBookingContacts } = await import("@/lib/payments.functions");
          await assertPaymentBookingContacts(reference);
        }
        const { error: updateError } = await supabaseAdmin.rpc("mark_payment_status", {
          p_reference: reference,
          p_new_status: nextStatus,
          p_provider_reference: verified.providerReference,
          p_failed_reason: nextStatus === "failed" ? verified.status : undefined,
          p_metadata: {
            verified_via: "delayed_recheck",
            paystack_receipt: paymentReceipt(verified, checkout.amountKobo),
          },
        });
        if (updateError) throw updateError;
        if (nextStatus === "succeeded") {
          try {
            const { syncClientRecordsForSuccessfulPayment } =
              await import("@/lib/payments.functions");
            await syncClientRecordsForSuccessfulPayment(reference);
            const { data: rows } = await supabaseAdmin
              .from("payments")
              .select("appointment_id")
              .or(`reference.eq.${reference},checkout_group_reference.eq.${reference}`);
            const { syncAppointmentToGoogle } = await import("@/lib/google.functions");
            await Promise.all(
              (rows ?? []).map((row) => syncAppointmentToGoogle(row.appointment_id as string)),
            );
          } catch (err) {
            console.error("[payments] delayed recheck google sync failed", payment.reference, err);
          }
        }
        if (nextStatus === "succeeded" || nextStatus === "failed") {
          const { sendPaymentEmailsForReference } = await import("@/lib/payments.functions");
          await sendPaymentEmailsForReference(
            reference,
            nextStatus === "succeeded" ? "payment_success" : "payment_failed",
          );
        }
      }
      results.push({ reference, status: nextStatus });
    } catch (error) {
      console.error("[payments] delayed recheck failed", payment.reference, error);
      results.push({ reference, status: "error" });
    }
  }

  return Response.json({ ok: true, scanned: payments?.length ?? 0, results, emailRetries });
}

export const Route = createFileRoute("/api/public/hooks/recheck-payments")({
  server: {
    handlers: {
      POST: ({ request }) => recheckPayments(request),
      GET: ({ request }) => recheckPayments(request),
    },
  },
});
