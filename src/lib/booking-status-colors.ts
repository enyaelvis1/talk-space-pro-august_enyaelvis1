export type BookingStatusTone = "confirmed" | "completed" | "pending" | "cancelled";

export type BookingStatusStyle = {
  tone: BookingStatusTone;
  label: string;
  /** Badge (soft surface + strong text). */
  badgeClass: string;
  /** Small solid dot, for calendar cells and list markers. */
  dotClass: string;
  /** Card surface + border, for panels and dialog cards. */
  surfaceClass: string;
  /** Left accent bar / border colour only. */
  borderClass: string;
  /** Strong text colour. */
  textClass: string;
};

const TONE_BY_STATUS: Record<string, BookingStatusTone> = {
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "cancelled",
  hold: "pending",
  pending_payment: "pending",
};

const TONE_STYLES: Record<BookingStatusTone, Omit<BookingStatusStyle, "tone" | "label">> = {
  confirmed: {
    badgeClass: "bg-status-confirmed-soft text-status-confirmed-strong",
    dotClass: "bg-status-confirmed",
    surfaceClass: "border-status-confirmed/40 bg-status-confirmed-soft",
    borderClass: "border-status-confirmed",
    textClass: "text-status-confirmed-strong",
  },
  completed: {
    badgeClass: "bg-status-completed-soft text-status-completed-strong",
    dotClass: "bg-status-completed",
    surfaceClass: "border-status-completed/40 bg-status-completed-soft",
    borderClass: "border-status-completed",
    textClass: "text-status-completed-strong",
  },
  pending: {
    badgeClass: "bg-status-pending-soft text-status-pending-strong",
    dotClass: "bg-status-pending",
    surfaceClass: "border-status-pending/40 bg-status-pending-soft",
    borderClass: "border-status-pending",
    textClass: "text-status-pending-strong",
  },
  cancelled: {
    badgeClass: "bg-status-cancelled-soft text-status-cancelled-strong",
    dotClass: "bg-status-cancelled",
    surfaceClass: "border-status-cancelled/40 bg-status-cancelled-soft",
    borderClass: "border-status-cancelled",
    textClass: "text-status-cancelled-strong",
  },
};

export function getBookingStatusTone(status: string): BookingStatusTone {
  return TONE_BY_STATUS[status] ?? "pending";
}

export function getBookingStatusStyle(status: string): BookingStatusStyle {
  const tone = getBookingStatusTone(status);
  return {
    tone,
    label: status.replaceAll("_", " "),
    ...TONE_STYLES[tone],
  };
}

export const BOOKING_STATUS_LEGEND: Array<{ tone: BookingStatusTone; label: string }> = [
  { tone: "confirmed", label: "Confirmed" },
  { tone: "pending", label: "Pending" },
  { tone: "completed", label: "Completed" },
  { tone: "cancelled", label: "Cancelled" },
];

export function getToneStyle(tone: BookingStatusTone) {
  return TONE_STYLES[tone];
}
