export const INTAKE_CONSENT_VERSION = "2026-07-29";

export const INTAKE_CONSENT_TEXT =
  "I understand Talk Space will use the information I share to arrange, confirm, and support my counselling request in line with the privacy policy.";

export type IntakeConsentSnapshot = {
  version: string;
  text: string;
  route: "/book" | "/contact";
  acknowledgedAt: string;
};

export function buildIntakeConsentSnapshot(route: IntakeConsentSnapshot["route"]) {
  return {
    version: INTAKE_CONSENT_VERSION,
    text: INTAKE_CONSENT_TEXT,
    route,
    acknowledgedAt: new Date().toISOString(),
  } satisfies IntakeConsentSnapshot;
}
