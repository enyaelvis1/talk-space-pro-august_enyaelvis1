import type { UpcomingAppointmentRow } from "@/lib/booking.functions";

export type BookingCalendarDay = {
  dateKey: string;
  date: Date;
  count: number;
  appointments: UpcomingAppointmentRow[];
  isCurrentMonth: boolean;
};

export type BookingCalendarMonth = {
  monthKey: string;
  monthLabel: string;
  days: BookingCalendarDay[];
};

export type BookingDaySummary = {
  selectedDate: string;
  currentAppointments: UpcomingAppointmentRow[];
  upcomingAppointments: UpcomingAppointmentRow[];
  pastAppointments: UpcomingAppointmentRow[];
};

const COMMITTED_BOOKING_STATUSES = new Set(["confirmed", "completed", "cancelled", "no_show"]);
const CONFIRMED_PAYMENT_STATUSES = new Set(["succeeded", "refunded"]);
const EXPIRED_HOLD_REVOCATION_REASON = "hold_expired";

export function isVisibleOnAdminBookingCalendar(appointment: UpcomingAppointmentRow): boolean {
  if (appointment.archivedAt) return false;
  if (
    ["cancelled", "no_show"].includes(appointment.status) &&
    !CONFIRMED_PAYMENT_STATUSES.has(appointment.paymentStatus ?? "")
  ) {
    return false;
  }
  if (
    appointment.status === "cancelled" &&
    appointment.manageTokenRevocationReason === EXPIRED_HOLD_REVOCATION_REASON
  ) {
    return false;
  }
  return COMMITTED_BOOKING_STATUSES.has(appointment.status);
}

export function getAdminBookingCalendarRows(
  appointments: UpcomingAppointmentRow[],
): UpcomingAppointmentRow[] {
  return appointments.filter(isVisibleOnAdminBookingCalendar);
}

export function getHiddenAdminTemporaryRows(
  appointments: UpcomingAppointmentRow[],
): UpcomingAppointmentRow[] {
  return appointments.filter((appointment) => !isVisibleOnAdminBookingCalendar(appointment));
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function buildBookingCalendarMonth(
  anchor: Date,
  appointments: UpcomingAppointmentRow[],
): BookingCalendarMonth {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const days: BookingCalendarDay[] = [];
  const startOffset = monthStart.getUTCDay();
  const totalCells = Math.ceil((monthEnd.getUTCDate() + startOffset) / 7) * 7;

  for (let index = 0; index < totalCells; index += 1) {
    const dayDate = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), index - startOffset + 1),
    );
    const dateKey = toDateKey(dayDate);
    const dayAppointments = appointments.filter(
      (appointment) => toDateKey(new Date(appointment.startsAt)) === dateKey,
    );
    days.push({
      dateKey,
      date: dayDate,
      count: dayAppointments.length,
      appointments: dayAppointments,
      isCurrentMonth: dayDate.getUTCMonth() === anchor.getUTCMonth(),
    });
  }

  return {
    monthKey: toDateKey(monthStart),
    monthLabel: monthStart.toLocaleString("en-NG", {
      month: "long",
      year: "numeric",
      timeZone: "Africa/Lagos",
    }),
    days,
  };
}

export function getAppointmentsForDate(
  appointments: UpcomingAppointmentRow[],
  dateKey: string,
): UpcomingAppointmentRow[] {
  return appointments.filter(
    (appointment) => toDateKey(new Date(appointment.startsAt)) === dateKey,
  );
}

export function getDaySummary(
  appointments: UpcomingAppointmentRow[],
  dateKey: string,
  nowIso: string,
): BookingDaySummary {
  const selected = getAppointmentsForDate(appointments, dateKey).sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const now = new Date(nowIso).getTime();
  const currentAppointments = selected.filter(
    (appointment) =>
      appointment.status === "confirmed" &&
      new Date(appointment.startsAt).getTime() <= now &&
      new Date(appointment.endsAt).getTime() > now,
  );
  const currentIds = new Set(currentAppointments.map((appointment) => appointment.id));
  const upcomingAppointments = selected.filter(
    (appointment) => new Date(appointment.startsAt).getTime() > now,
  );
  const pastAppointments = selected.filter(
    (appointment) =>
      new Date(appointment.startsAt).getTime() <= now && !currentIds.has(appointment.id),
  );

  return {
    selectedDate: dateKey,
    currentAppointments,
    upcomingAppointments,
    pastAppointments,
  };
}

export type BookingNowSummary = {
  /** Sessions whose window contains "now". */
  live: UpcomingAppointmentRow[];
  /** The very next sessions starting after "now", across all dates. */
  nextUp: UpcomingAppointmentRow[];
};

const CANCELLED_STATUSES = new Set(["cancelled", "no_show"]);

export function getNowSummary(
  appointments: UpcomingAppointmentRow[],
  nowIso: string,
  nextUpLimit = 5,
): BookingNowSummary {
  const now = new Date(nowIso).getTime();
  const active = appointments
    .filter((appointment) => !CANCELLED_STATUSES.has(appointment.status))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  const live = active.filter((appointment) => {
    const startsAt = new Date(appointment.startsAt).getTime();
    const endsAt = new Date(appointment.endsAt).getTime();
    return startsAt <= now && endsAt > now;
  });
  const nextUp = active
    .filter((appointment) => new Date(appointment.startsAt).getTime() > now)
    .slice(0, nextUpLimit);

  return { live, nextUp };
}

/**
 * Returns the ISO timestamp for the same time-of-day moved onto `dateKey`
 * (`YYYY-MM-DD`), used when an appointment card is dropped on another day.
 */
export function shiftAppointmentToDate(startsAtIso: string, dateKey: string): string {
  const source = new Date(startsAtIso);
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  if (Number.isNaN(source.getTime()) || !year || !month || !day) {
    throw new Error("Invalid drop target date.");
  }
  const next = new Date(source.getTime());
  next.setUTCFullYear(year, month - 1, day);
  return next.toISOString();
}

export function isSameDateKey(startsAtIso: string, dateKey: string): boolean {
  return toDateKey(new Date(startsAtIso)) === dateKey;
}
