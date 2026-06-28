import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { googleScopes, summarizeGoogleCalendarSyncErrors, taskGoogleCalendarPayload } = await import("../lib/google");

describe("Google Calendar sync helpers", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_ENABLE_DRIVE_SCOPE;
  });

  it("deduplicates repeated manual sync errors", () => {
    expect(summarizeGoogleCalendarSyncErrors(["missing column", "missing column", "token expired"])).toBe(
      "2 unique errors: missing column | token expired",
    );
  });

  it("requests only identity scopes for Google login by default", () => {
    expect(googleScopes()).toEqual(["openid", "email", "profile"]);
  });

  it("requests Calendar scope for Google connect", () => {
    expect(googleScopes({ includeCalendar: true })).toEqual([
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ]);
  });

  it("only includes Drive scope for Google connect when explicitly enabled", () => {
    process.env.GOOGLE_ENABLE_DRIVE_SCOPE = "true";
    expect(googleScopes({ includeCalendar: true })).toContain("https://www.googleapis.com/auth/drive.metadata.readonly");
    expect(googleScopes()).not.toContain("https://www.googleapis.com/auth/drive.metadata.readonly");
  });

  it("builds a Johannesburg one-hour task payload at the intended wall-clock time", () => {
    const payload = taskGoogleCalendarPayload(
      {
        id: "task-1",
        title: "Client follow-up",
        due_date: "2026-06-20T17:00:00.000Z",
        duration_minutes: 60,
        priority: "HIGH",
      },
      [],
      "Africa/Johannesburg",
    );

    expect(payload.start).toEqual({ dateTime: "2026-06-20T19:00:00", timeZone: "Africa/Johannesburg" });
    expect(payload.end).toEqual({ dateTime: "2026-06-20T20:00:00", timeZone: "Africa/Johannesburg" });
  });
});
