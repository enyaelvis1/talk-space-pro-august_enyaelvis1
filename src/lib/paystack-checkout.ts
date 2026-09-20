import { isMinorAmount } from "./payment-validation.ts";

export type CheckoutPayment = {
  reference: string;
  checkout_group_reference: string | null;
  amount_kobo: number;
  currency: string;
  provider: string;
  status: string;
};

export function summarizePaystackCheckout(rows: CheckoutPayment[], reference: string) {
  if (!rows.length || !rows.some((row) => row.reference === reference)) {
    throw new Error("Payment not found.");
  }
  let amountKobo = 0;
  const currency = rows[0].currency;
  for (const row of rows) {
    if (
      row.provider !== "paystack" ||
      row.currency !== currency ||
      (row.checkout_group_reference ?? row.reference) !== reference ||
      !isMinorAmount(row.amount_kobo) ||
      row.amount_kobo === 0
    ) {
      throw new Error("Invalid Paystack checkout records.");
    }
    amountKobo += row.amount_kobo;
  }
  if (!isMinorAmount(amountKobo)) throw new Error("Invalid checkout total.");
  return {
    amountKobo,
    currency,
    alreadySucceeded: rows.every((row) => row.status === "succeeded"),
  };
}
