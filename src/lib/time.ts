export const APP_TIME_ZONE = "Africa/Lagos";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: APP_TIME_ZONE,
});

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-NG", {
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

export function formatWATDateTime(value: string | number | Date | null | undefined) {
  if (value == null || value === "") return "—";
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatWATTime(value: string | number | Date | null | undefined) {
  if (value == null || value === "") return "—";
  try {
    return timeFormatter.format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatterParts(formatter: Intl.DateTimeFormat, value: Date) {
  return Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
}

export function formatWATDateKey(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const parts = formatterParts(dateKeyFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export type WATDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getWATDateTimeParts(value: string | number | Date): WATDateTimeParts {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  const parts = formatterParts(dateTimePartsFormatter, date);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Convert a wall-clock date/time in Africa/Lagos back to an instant. */
export function zonedWATDateTimeToUtc(
  dateKey: string,
  time: Pick<WATDateTimeParts, "hour" | "minute" | "second">,
  milliseconds = 0,
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (![year, month, day, time.hour, time.minute, time.second].every(Number.isFinite)) {
    throw new Error("Invalid Africa/Lagos date/time.");
  }

  const guess = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second, milliseconds);
  const represented = getWATDateTimeParts(new Date(guess));
  const representedAsUtc = Date.UTC(
    represented.year,
    represented.month - 1,
    represented.day,
    represented.hour,
    represented.minute,
    represented.second,
    milliseconds,
  );
  return new Date(guess - (representedAsUtc - guess)).toISOString();
}
