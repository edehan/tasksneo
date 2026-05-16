const DEFAULT_TIME_ZONE = "UTC";

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parsePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getBrowserTimeZone(): string {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getZonedDateTimeParts(
  date: Date,
  timeZone: string,
): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: parsePart(parts, "year"),
    month: parsePart(parts, "month"),
    day: parsePart(parts, "day"),
    hour: parsePart(parts, "hour"),
    minute: parsePart(parts, "minute"),
    second: parsePart(parts, "second"),
  };
}

export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getZonedDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}

export function formatTimeZoneOffset(timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: normalizeTimeZone(timeZone),
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function zonedDateTimeToDate(
  parts: ZonedDateTimeParts,
  timeZone: string,
): Date {
  const wallTimeUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let result = new Date(wallTimeUtc);

  for (let i = 0; i < 4; i++) {
    const offsetMs = getTimeZoneOffsetMinutes(result, timeZone) * 60 * 1000;
    result = new Date(wallTimeUtc - offsetMs);
  }

  return result;
}

export function getCalendarDateInTimeZone(date: Date, timeZone: string): Date {
  const parts = getZonedDateTimeParts(date, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function calendarDateToZonedDateTime(
  date: Date,
  timeZone: string,
  time: { hour: number; minute: number },
): Date {
  return zonedDateTimeToDate(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: time.hour,
      minute: time.minute,
      second: 0,
    },
    timeZone,
  );
}

export function formatZonedDateTime(date: Date, timeZone: string): string {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")} ${String(parts.hour).padStart(2, "0")}:${String(
    parts.minute,
  ).padStart(2, "0")}`;
}

export function formatDateInTimeZone(
  date: Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: normalizeTimeZone(timeZone),
  }).format(date);
}
