import { z } from "zod";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const availabilitySlotInputSchema = z
  .object({
    therapistId: z.string().regex(uuidPattern, "Choose a therapist"),
    mode: z.enum(["online", "in_person"]),
    date: z.string().regex(datePattern, "Choose a valid date"),
    startsAt: z.string().regex(timePattern, "Choose a valid start time"),
    endsAt: z.string().regex(timePattern, "Choose a valid end time"),
    reason: z.string().trim().max(120, "Reason must be under 120 characters"),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    path: ["endsAt"],
    message: "End time must be after the start time",
  })
  .refine(
    (value) => [value.startsAt, value.endsAt].every((time) => Number(time.slice(3)) % 15 === 0),
    {
      path: ["startsAt"],
      message: "Start and end times must use 15-minute increments",
    },
  );
