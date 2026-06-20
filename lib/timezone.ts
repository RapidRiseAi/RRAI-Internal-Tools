export const defaultAppTimeZone = "Africa/Johannesburg";

export function appTimeZone() {
  return process.env.APP_TIME_ZONE || process.env.NEXT_PUBLIC_APP_TIME_ZONE || defaultAppTimeZone;
}

export function isValidTimeZone(timeZone: string | null | undefined) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined) {
  return isValidTimeZone(timeZone) ? String(timeZone) : appTimeZone();
}

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTimeZone(date: Date, timeZone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour) % 24,
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
}

function partsAsUtcMs(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function parseZonedDateTime(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute, second = "0"] = match;
  const desired: DateTimeParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const zone = normalizeTimeZone(timeZone);
  const desiredAsUtc = partsAsUtcMs(desired);
  let instant = desiredAsUtc;
  for (let index = 0; index < 3; index += 1) {
    const zoned = partsAsUtcMs(partsInTimeZone(new Date(instant), zone));
    const delta = desiredAsUtc - zoned;
    if (delta === 0) break;
    instant += delta;
  }
  return new Date(instant);
}

export function formatDateTimeLocal(value: Date | string | null | undefined, timeZone?: string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = partsInTimeZone(date, normalizeTimeZone(timeZone));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatDateTimeForGoogle(value: Date | string, timeZone?: string | null) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = partsInTimeZone(date, normalizeTimeZone(timeZone));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

export function dateKeyInTimeZone(value: Date | string, timeZone?: string | null) {
  return formatDateTimeLocal(value, timeZone).slice(0, 10);
}

export function hourInTimeZone(value: Date | string | null | undefined, timeZone?: string | null) {
  if (!value) return 9;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 9;
  return partsInTimeZone(date, normalizeTimeZone(timeZone)).hour;
}
