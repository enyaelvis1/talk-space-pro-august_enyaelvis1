export const CHECKOUT_WINDOW_MS = 5 * 60 * 1000;

export type BookingTokenLifecycle = {
  status?: string | null;
  created_at?: string | null;
  hold_expires_at?: string | null;
  manage_token_expires_at?: string | null;
  manage_token_revoked_at?: string | null;
};

export function checkoutDeadline(row: BookingTokenLifecycle): number {
  const created = Date.parse(row.created_at ?? "");
  if (!Number.isFinite(created)) return Number.NaN;
  const deadlines = [created + CHECKOUT_WINDOW_MS];
  for (const value of [row.hold_expires_at, row.manage_token_expires_at]) {
    if (value != null) {
      const parsed = Date.parse(value);
      if (!Number.isFinite(parsed)) return Number.NaN;
      deadlines.push(parsed);
    }
  }
  return Math.min(...deadlines);
}

export function isBookingTokenActive(row: BookingTokenLifecycle, now = Date.now()): boolean {
  if (
    row.manage_token_revoked_at ||
    !row.status ||
    ["cancelled", "completed", "no_show"].includes(row.status)
  )
    return false;
  if (["hold", "pending_payment"].includes(row.status)) return checkoutDeadline(row) > now;
  return Date.parse(row.manage_token_expires_at ?? "") > now;
}

export function assertCheckoutOpen(row: BookingTokenLifecycle, now = Date.now()) {
  if (!["hold", "pending_payment"].includes(row.status ?? "") || !isBookingTokenActive(row, now)) {
    throw new Error(
      "This checkout has expired or is closed. Start a new booking. If you already paid, contact support with your payment reference.",
    );
  }
}
