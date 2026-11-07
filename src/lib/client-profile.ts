import { z } from "zod";

export const clientPhoneSchema = z
  .string()
  .trim()
  .superRefine((value, context) => {
    const phonePattern = /^\+?[\d\s().\-\x2f]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?$/i;
    const digitCount = value.replace(/\D/g, "").length;
    if (value.length > 40 || !phonePattern.test(value) || digitCount < 7 || digitCount > 20) {
      context.addIssue({ code: "custom", message: "Enter a valid phone number (7–20 digits)." });
    }
  });

export const clientContactSchema = z.object({
  fullName: z.string().trim().min(2).max(250),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  phone: clientPhoneSchema,
});

export function getClientContactCompletionState(input: {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const value = {
    fullName: (input.fullName ?? "").trim(),
    email: (input.email ?? "").trim().toLowerCase(),
    phone: (input.phone ?? "").trim(),
  };
  const result = clientContactSchema.safeParse(value);
  const missing = result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.path[0] as keyof typeof value))];
  return { ...value, missing, isComplete: result.success };
}
