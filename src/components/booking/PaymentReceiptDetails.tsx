import type { PaymentReceipt } from "@/lib/payment-validation";

export function PaymentReceiptDetails({
  receipt,
  showProviderFee = false,
}: {
  receipt: PaymentReceipt;
  showProviderFee?: boolean;
}) {
  const money = (kobo: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: receipt.currency,
    }).format(kobo / 100);
  return (
    <dl className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
      <dt className="text-left text-muted-foreground">Booking total</dt>
      <dd className="text-right">{money(receipt.bookingAmountKobo)}</dd>
      <dt className="text-left text-muted-foreground">Checkout fees added</dt>
      <dd className="text-right">{money(receipt.customerFeeKobo)}</dd>
      <dt className="text-left font-medium">Total paid for checkout</dt>
      <dd className="text-right font-medium">{money(receipt.amountKobo)}</dd>
      {showProviderFee ? (
        <>
          <dt className="text-left text-muted-foreground">Paystack processing fee</dt>
          <dd className="text-right">
            {receipt.feesKobo == null ? "Not reported" : money(receipt.feesKobo)}
          </dd>
        </>
      ) : null}
    </dl>
  );
}
