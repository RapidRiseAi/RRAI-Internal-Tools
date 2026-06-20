import { describe, expect, it } from "vitest";

import { formatDateTimeLocal, parseZonedDateTime } from "../lib/timezone";

describe("timezone conversion utilities", () => {
  it("stores a Johannesburg datetime-local value as the matching UTC instant", () => {
    expect(parseZonedDateTime("2026-06-20T19:00", "Africa/Johannesburg")?.toISOString()).toBe("2026-06-20T17:00:00.000Z");
  });

  it("formats a stored instant back to the same Johannesburg datetime-local value", () => {
    expect(formatDateTimeLocal("2026-06-20T17:00:00.000Z", "Africa/Johannesburg")).toBe("2026-06-20T19:00");
  });

  it("keeps the instant stable when an unchanged edit value is parsed again", () => {
    const stored = "2026-06-20T17:00:00.000Z";
    const editValue = formatDateTimeLocal(stored, "Africa/Johannesburg");
    expect(parseZonedDateTime(editValue, "Africa/Johannesburg")?.toISOString()).toBe(stored);
  });

  it("uses explicit different IANA timezones when provided", () => {
    expect(parseZonedDateTime("2026-06-20T19:00", "Europe/London")?.toISOString()).toBe("2026-06-20T18:00:00.000Z");
    expect(formatDateTimeLocal("2026-06-20T18:00:00.000Z", "Europe/London")).toBe("2026-06-20T19:00");
  });
});
