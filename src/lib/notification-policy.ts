type BookingState = { status: string; archived_at: string | null };
type IntakeState = { source: string; completion_state: string };

// Apply this again at delivery time so queued messages cannot trust old payloads.
export async function notificationSuppressionReason(
  templateKey: string,
  data: Record<string, unknown>,
  lookupBooking: (reference: string) => Promise<BookingState | null>,
  lookupIntake: (id: string) => Promise<IntakeState | null>,
): Promise<string | null> {
  if (templateKey === "form_reminder") {
    if (typeof data.intakeSubmissionId !== "string" || !data.intakeSubmissionId) {
      return "unscoped_form_reminder";
    }
    const intake = await lookupIntake(data.intakeSubmissionId);
    if (intake?.source === "booking") return "booking_reminders_awaiting_approval";
    if (intake?.source !== "contact") return "unscoped_form_reminder";
    return ["draft", "in_progress"].includes(intake.completion_state)
      ? null
      : "form_already_completed";
  }

  if (
    ![
      "booking_admin_notice",
      "booking_confirmation",
      "therapist_booking_notice",
      "booking_reminder_24h",
      "booking_reminder_1h",
      "reschedule_notice",
    ].includes(templateKey)
  )
    return null;

  if (typeof data.reference !== "string" || !data.reference) return "booking_not_committed";
  const booking = await lookupBooking(data.reference);
  return booking?.status === "confirmed" && booking.archived_at === null
    ? null
    : "booking_not_committed";
}
