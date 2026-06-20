import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { googleScopes, summarizeGoogleCalendarSyncErrors } = await import("../lib/google");

describe("Google Calendar sync helpers", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_ENABLE_DRIVE_SCOPE;
  });

  it("deduplicates repeated manual sync errors", () => {
    expect(summarizeGoogleCalendarSyncErrors(["missing column", "missing column", "token expired"])).toBe(
      "2 unique errors: missing column | token expired",
    );
  });

  it("requests Calendar scope by default without Drive scope", () => {
    expect(googleScopes()).toEqual([
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ]);
  });

  it("only includes Drive scope when explicitly enabled", () => {
    process.env.GOOGLE_ENABLE_DRIVE_SCOPE = "true";
    expect(googleScopes()).toContain("https://www.googleapis.com/auth/drive.metadata.readonly");
  });
});
