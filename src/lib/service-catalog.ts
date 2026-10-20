/**
 * Public service facts that must stay aligned with the booking seed data.
 * Prices remain admin-managed; durations and consultation wording are part of
 * the public product contract and are covered by the content contract tests.
 */
export const SERVICE_CATALOG = {
  clarityCall: {
    name: "Clarity Call",
    durationMinutes: 15,
    consultationLabel: "paid 15-minute consultation",
  },
  individual: { name: "Individual Therapy", durationMinutes: 60 },
  couple: { name: "Couple Therapy", durationMinutes: 90 },
  teenChild: { name: "Teen/Child Therapy", durationMinutes: 60 },
  premarital: { name: "Premarital Counselling", durationMinutes: 90 },
  family: { name: "Family Therapy", durationMinutes: 90 },
} as const;

export function durationLabel(minutes: number) {
  return `${minutes}-minute session${minutes === 1 ? "" : "s"}`;
}
