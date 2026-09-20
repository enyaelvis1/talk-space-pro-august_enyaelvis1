import { z } from "zod";

export const clientPhoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^\+?[\d\s().-]+$/, "Enter a valid phone number.")
  .refine((value) => value.replace(/\D/g, "").length >= 7, "Enter a valid phone number.");

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
