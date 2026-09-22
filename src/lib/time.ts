export const APP_TIME_ZONE = "Africa/Lagos";

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
