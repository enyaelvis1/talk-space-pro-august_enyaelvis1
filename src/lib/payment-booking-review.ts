// Payment settlement and booking fulfilment are separate states. A cancelled
// booking must never turn a genuine settled payment into a failed payment.
export type PaymentBookingState = {
  status: string;
  provider: string;
  bookingReviewRequired: boolean;
  appointmentStatus: string | null;
  appointmentArchivedAt: string | null;
  appointmentStartsAt: string | null;
};

export function bookingNeedsPaymentReview(
  status: string,
  paymentKind: string,
  appointmentStatus: string | null,
): boolean {
  return (
    status === "succeeded" &&
    paymentKind !== "package_purchase" &&
    !["confirmed", "completed", "no_show"].includes(appointmentStatus ?? "")
  );
}

export function isActivePaymentReview(row: PaymentBookingState): boolean {
  // Archiving removes a booking from active operations, not the financial
  // ledger. It remains visible in Archived bookings, Confirmed and All.
  if (row.appointmentArchivedAt) return false;
  return (
    row.bookingReviewRequired ||
    (row.provider === "bank_transfer" && row.status === "awaiting_confirmation") ||
    (row.provider === "paystack" && ["initiated", "pending"].includes(row.status))
  );
}

export function canRestorePaidBankBooking(row: PaymentBookingState, now = Date.now()): boolean {
  return (
    row.provider === "bank_transfer" &&
    row.status === "succeeded" &&
    row.appointmentStatus === "cancelled" &&
    row.bookingReviewRequired &&
    !row.appointmentArchivedAt &&
    Date.parse(row.appointmentStartsAt ?? "") > now
  );
}

export function paymentLifecycleLabel(row: PaymentBookingState): string {
  if (row.status === "refunded") return "Refunded payment";
  if (row.status === "cancelled") return "Cancelled payment";
  if (row.status === "failed") return "Failed payment";
  if (row.status === "succeeded" && row.appointmentArchivedAt) {
    return row.appointmentStatus === "cancelled"
      ? "Verified payment · cancelled booking archived"
      : "Verified payment · booking archived";
  }
  if (row.status === "succeeded" && row.appointmentStatus === "cancelled") {
    return "Verified payment · booking cancelled · reschedule required";
  }
  if (row.bookingReviewRequired) return "Verified payment · booking review required";
  if (row.status === "awaiting_confirmation") return "Pending payment review";
  if (row.status === "succeeded" && row.appointmentStatus === "completed")
    return "Verified payment · session completed";
  if (row.status === "succeeded" && row.appointmentStatus === "no_show")
    return "Verified payment · client did not attend";
  if (row.status === "succeeded" && row.appointmentStatus === null)
    return "Verified payment · package purchase";
  if (row.status === "succeeded") return "Verified payment · booking confirmed";
  return "Payment not verified";
}
