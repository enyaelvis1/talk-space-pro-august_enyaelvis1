import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-paystack-signature");
        const body = await request.text();
        if (!signature) {
          return new Response("missing_signature", { status: 401 });
        }

        const {
          loadPaystackWebhookSecret,
          loadPaystackSecret,
          verifyPaystackSignature,
          paystackVerify,
        } = await import("@/lib/payments.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { validateProviderPayment, paymentReceipt } =
          await import("@/lib/payment-validation");
        const { loadPaystackCheckout } = await import("@/lib/paystack-checkout.server");

        const webhookSecret = await loadPaystackWebhookSecret();
        if (!webhookSecret) {
          return new Response("webhook_secret_not_configured", { status: 503 });
        }

        if (!verifyPaystackSignature(body, signature, webhookSecret)) {
          return new Response("invalid_signature", { status: 401 });
        }

        let payload: {
          event?: string;
          data?: {
            reference?: string;
            status?: string;
            amount?: number;
            currency?: string;
            gateway_response?: string;
          };
        };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("invalid_json", { status: 400 });
        }

        const reference = payload.data?.reference;
        const event = payload.event ?? "unknown";
        if (!reference) {
          return new Response("ok", { status: 200 });
        }

        // Re-verify with Paystack API for defense in depth before mutating state.
        try {
          const secret = await loadPaystackSecret();
          if (!secret) {
            return new Response("paystack_secret_not_configured", { status: 503 });
          }

          let nextStatus: "succeeded" | "failed" | "cancelled" | "initiated" = "initiated";
          let failedReason: string | undefined;
          const verify = await paystackVerify({ secretKey: secret, reference });
          const checkout = await loadPaystackCheckout(reference);
          validateProviderPayment({
            expectedAmountKobo: checkout.amountKobo,
            expectedCurrency: checkout.currency,
            expectedReference: reference,
            result: verify,
          });
          const providerReference = verify.providerReference;
          if (verify.status === "success") nextStatus = "succeeded";
          else if (verify.status === "failed") nextStatus = "failed";
          else if (verify.status === "abandoned") nextStatus = "cancelled";
          else nextStatus = "initiated";
          if (nextStatus === "failed") failedReason = verify.status;
          if (checkout.alreadySucceeded && nextStatus !== "succeeded") {
            throw new Error("Paystack status conflicts with the confirmed payment.");
          }

          if (nextStatus === "succeeded") {
            const { assertPaymentBookingContacts } = await import("@/lib/payments.functions");
            await assertPaymentBookingContacts(reference);
          }

          if (nextStatus !== "initiated") {
            const { error } = await supabaseAdmin.rpc("mark_payment_status", {
              p_reference: reference,
              p_new_status: nextStatus,
              p_provider_reference: providerReference ?? undefined,
              p_failed_reason: failedReason ?? undefined,
              p_metadata: {
                webhook_event: event,
                paystack_receipt: paymentReceipt(verify, checkout.amountKobo),
              },
            });
            if (error && error.message !== "payment_not_found") {
              console.error("paystack_webhook_rpc_failed", error);
              return new Response("rpc_failed", { status: 500 });
            }
            if (!error && nextStatus === "succeeded") {
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
                  (rows ?? []).map((p) => syncAppointmentToGoogle(p.appointment_id as string)),
                );
              } catch (err) {
                console.error("paystack_webhook_google_sync_failed", err);
              }
            }
            if (!error && (nextStatus === "succeeded" || nextStatus === "failed")) {
              try {
                const { sendPaymentEmailsForReference } = await import("@/lib/payments.functions");
                await sendPaymentEmailsForReference(
                  reference,
                  nextStatus === "succeeded" ? "payment_success" : "payment_failed",
                );
              } catch (err) {
                console.error("paystack_webhook_email_failed", err);
              }
            }
          }
        } catch (err) {
          console.error("paystack_webhook_error", err);
          return new Response("processing_error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
