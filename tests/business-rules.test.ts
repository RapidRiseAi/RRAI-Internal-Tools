import { describe, expect, it } from "vitest";
import { calculateCommissionCents, nextCommissionStatus } from "@/lib/business-rules";

describe("commission business rules", () => {
  it("only makes commission payable after payment is paid", () => {
    expect(nextCommissionStatus("APPROVED", "PENDING")).toBe("APPROVED");
    expect(nextCommissionStatus("APPROVED", "PAID")).toBe("PAYABLE");
  });

  it("does not mutate terminal commission states", () => {
    expect(nextCommissionStatus("PAID", "PAID")).toBe("PAID");
    expect(nextCommissionStatus("DISPUTED", "PAID")).toBe("DISPUTED");
  });

  it("calculates percentage commission in cents", () => {
    expect(calculateCommissionCents(250000, 10)).toBe(25000);
  });
});
