export type BookingSlot = {
  therapistId: string;
  therapistName?: string | null;
  startsAt: string;
  endsAt: string;
  mode: "online" | "in_person";
};

export function slotKey(slot: Pick<BookingSlot, "therapistId" | "startsAt">) {
  return `${slot.therapistId}:${new Date(slot.startsAt).toISOString()}`;
}

export function uniqueBookingSlots<T extends BookingSlot>(slots: T[]): T[] {
  return [...new Map(slots.map((slot) => [`${slotKey(slot)}:${slot.mode}`, slot])).values()];
}

export function formatSlotLabel(slot: BookingSlot) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(slot.startsAt));
}

export function formatSlotTime(slot: Pick<BookingSlot, "startsAt">) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(slot.startsAt));
}
