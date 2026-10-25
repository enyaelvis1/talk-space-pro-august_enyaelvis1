import type { SendResult } from "./email.server";

type ReminderDelivery = {
  recipient: "client" | "partner";
  claim: () => Promise<boolean>;
  send: () => Promise<SendResult>;
  finalize: (sent: boolean) => Promise<void>;
  stampClient: (at: string) => Promise<void>;
  now?: () => string;
};

/** A primary-client timestamp must not suppress an independently claimed partner. */
export function reminderRecipientPending(
  recipient: "client" | "partner",
  clientSentAt: string | null,
) {
  return recipient === "partner" || !clientSentAt;
}

/** Keep the sender's sent/skipped/failed logs and distinguish policy suppression. */
export function reminderDeliveryOutcome(result: SendResult) {
  if (result.sent) return "sent";
  if (
    [
      "booking_not_committed",
      "booking_reminders_awaiting_approval",
      "unscoped_form_reminder",
      "form_already_completed",
    ].includes(result.reason)
  )
    return "suppressed";
  if (
    [
      "emails_disabled",
      "template_disabled",
      "from_email_not_configured",
      "api_key_not_configured",
      "notification_claimed",
      "no_recipient",
    ].includes(result.reason)
  )
    return "skipped";
  return "failed";
}

/**
 * Framework-independent seam for mocked delivery tests. Claim/finalize stay
 * recipient-specific in the caller. A partner send must never stamp the client.
 */
export async function deliverClaimedReminder(options: ReminderDelivery): Promise<SendResult> {
  if (!(await options.claim())) return { sent: false, reason: "notification_claimed", logId: null };
  let result: SendResult;
  try {
    result = await options.send();
  } catch (error) {
    await options.finalize(false);
    throw error;
  }
  await options.finalize(result.sent);
  if (options.recipient === "client" && reminderDeliveryOutcome(result) === "sent") {
    await options.stampClient((options.now ?? (() => new Date().toISOString()))());
  }
  return result;
}
