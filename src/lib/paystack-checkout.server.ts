import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { summarizePaystackCheckout } from "@/lib/paystack-checkout";

export async function loadPaystackCheckout(reference: string) {
  // References enter a PostgREST filter below. Accept only our reference alphabet.
  if (!/^[A-Za-z0-9_-]{4,120}$/.test(reference)) throw new Error("Invalid payment reference.");
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, reference, payment_kind, checkout_group_reference, amount_kobo, currency, provider, status, metadata, appointments(booking_reference, status)",
    )
    .or(`reference.eq.${reference},checkout_group_reference.eq.${reference}`);
  if (error) throw error;
  const rows = data ?? [];
  const summary = summarizePaystackCheckout(rows, reference);
  return {
    ...summary,
    payment: rows.find((row) => row.reference === reference)!,
    bookingReviewRequired: rows.some(
      (row) =>
        row.payment_kind !== "package_purchase" &&
        !["confirmed", "completed", "no_show"].includes(row.appointments?.status ?? ""),
    ),
  };
}
