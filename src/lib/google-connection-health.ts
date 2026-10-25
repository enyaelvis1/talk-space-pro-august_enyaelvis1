export type CalendarHealth = "healthy" | "expired" | "disconnected" | "failed" | "renewal_needed";

type Connection = {
  connected: boolean;
  watchExpiresAt: string | null;
  lastSyncError: string | null;
  failingAppointmentCount: number;
};

/** OAuth presence alone does not establish a live push subscription. */
export function googleConnectionHealth(
  connection: Connection,
  now = Date.now(),
): {
  state: CalendarHealth;
  label: string;
  guidance: string;
} {
  if (!connection.connected) {
    return {
      state: "disconnected",
      label: "Disconnected",
      guidance:
        "Connect or reconnect this therapist's Google account with the account owner's approval.",
    };
  }
  if (connection.lastSyncError || connection.failingAppointmentCount > 0) {
    return {
      state: "failed",
      label: "Sync failed",
      guidance:
        "Review the recorded error and affected appointments before an authorized manual retry.",
    };
  }
  const expires = connection.watchExpiresAt ? Date.parse(connection.watchExpiresAt) : NaN;
  if (!Number.isFinite(expires)) {
    return {
      state: "renewal_needed",
      label: "Renewal needed",
      guidance:
        "No valid push expiry is recorded. Ask the Calendar owner to renew the push subscription. Sync busy alone does not renew it.",
    };
  }
  if (expires <= now) {
    return {
      state: "expired",
      label: "Push subscription expired",
      guidance:
        "Push updates are no longer assured. Arrange an authorized renewal; Sync busy refreshes availability but does not renew push notifications.",
    };
  }
  if (expires - now <= 24 * 60 * 60 * 1000) {
    return {
      state: "renewal_needed",
      label: "Renewal needed",
      guidance:
        "The push subscription expires within 24 hours. Arrange renewal with the Calendar owner before it expires.",
    };
  }
  return {
    state: "healthy",
    label: "Healthy",
    guidance:
      "Connected with an unexpired push subscription and no recorded sync failures. This does not certify every appointment's delivery.",
  };
}
