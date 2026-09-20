export type ProviderPaymentResult = {
  amountKobo: number;
  currency: string;
  providerReference: string;
  requestedAmountKobo?: number | null;
  feesKobo?: number | null;
};

export function checkoutPaymentTotal(
  items: Array<{ amount_kobo: number | string; currency: string }>,
): { amountKobo: number; currency: string } {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Checkout total is required.");
  }

  const normalized = items.map((item) => {
    const amount = Number(item.amount_kobo);
    const currency = String(item.currency ?? "")
      .trim()
      .toUpperCase();

    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      throw new Error("Checkout amount is invalid.");
    }
    if (!currency) {
      throw new Error("Checkout currency is required.");
    }

    return { amount, currency };
  });

  const currencies = new Set(normalized.map((item) => item.currency));
  if (currencies.size > 1) {
    throw new Error("Checkout amounts must use the same currency.");
  }

  return {
    amountKobo: normalized.reduce((total, item) => total + item.amount, 0),
    currency: [...currencies][0],
  };
}

export function isMinorAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validateProviderPayment(params: {
  expectedAmountKobo: number;
  expectedCurrency: string;
  expectedReference: string;
  result: ProviderPaymentResult;
}) {
  const expectedMinorAmount = params.expectedAmountKobo;
  const actualMinorAmount = params.result.amountKobo;
  const { requestedAmountKobo, feesKobo } = params.result;
  if (
    !isMinorAmount(expectedMinorAmount) ||
    expectedMinorAmount === 0 ||
    !isMinorAmount(actualMinorAmount) ||
    (feesKobo != null && (!isMinorAmount(feesKobo) || feesKobo > actualMinorAmount)) ||
    (requestedAmountKobo != null && requestedAmountKobo !== expectedMinorAmount)
  ) {
    throw new Error("Payment amount does not match the booking amount.");
  }

  // Never guess units or accept arbitrary overpayments. Only Paystack's verified
  // requested amount and fee can explain a customer-paid surcharge.
  const passedFee =
    requestedAmountKobo === expectedMinorAmount &&
    isMinorAmount(feesKobo) &&
    actualMinorAmount > expectedMinorAmount &&
    actualMinorAmount - expectedMinorAmount <= feesKobo;
  if (actualMinorAmount !== expectedMinorAmount && !passedFee) {
    throw new Error("Payment amount does not match the booking amount.");
  }
  if (params.result.currency.toUpperCase() !== params.expectedCurrency.toUpperCase()) {
    throw new Error("Payment currency does not match the booking currency.");
  }
  if (params.result.providerReference !== params.expectedReference) {
    throw new Error("Payment reference does not match the booking reference.");
  }
}

export type PaymentReceipt = {
  amountKobo: number;
  bookingAmountKobo: number;
  feesKobo: number | null;
  customerFeeKobo: number;
  currency: string;
};

export function paymentReceipt(
  result: ProviderPaymentResult,
  bookingAmountKobo: number,
): PaymentReceipt {
  return {
    amountKobo: result.amountKobo,
    bookingAmountKobo,
    feesKobo: result.feesKobo ?? null,
    customerFeeKobo: result.amountKobo - bookingAmountKobo,
    currency: result.currency,
  };
}

export function readPaymentReceipt(metadata: unknown): PaymentReceipt | null {
  if (!metadata || typeof metadata !== "object" || !("paystack_receipt" in metadata)) return null;
  const receipt = metadata.paystack_receipt as PaymentReceipt | null;
  if (
    !receipt ||
    !isMinorAmount(receipt.amountKobo) ||
    !isMinorAmount(receipt.bookingAmountKobo) ||
    !isMinorAmount(receipt.customerFeeKobo) ||
    typeof receipt.currency !== "string"
  )
    return null;
  try {
    validateProviderPayment({
      expectedAmountKobo: receipt.bookingAmountKobo,
      expectedCurrency: receipt.currency,
      expectedReference: "stored",
      result: {
        ...receipt,
        requestedAmountKobo: receipt.bookingAmountKobo,
        providerReference: "stored",
      },
    });
    if (receipt.customerFeeKobo !== receipt.amountKobo - receipt.bookingAmountKobo) return null;
    return receipt;
  } catch {
    return null;
  }
}

export function parsePaystackVerification(data: {
  status?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  requested_amount?: number | null;
  fees?: number | null;
}) {
  return {
    status: data.status ?? "unknown",
    amountKobo: data.amount ?? Number.NaN,
    currency: data.currency ?? "",
    providerReference: data.reference ?? "",
    requestedAmountKobo: data.requested_amount ?? null,
    feesKobo: data.fees ?? null,
  };
}

export function isRecheckablePaymentStatus(status: string) {
  return status === "initiated";
}
