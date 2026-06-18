import { describe, expect, it } from "vitest";
import { buildOnceOffInvoiceItemsFromQuoteItems, calculateCommissionCents, nextCommissionStatus } from "@/lib/business-rules";

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


describe("quote acceptance invoice items", () => {
  it("builds once-off invoice items from quote item once-off amounts", () => {
    expect(buildOnceOffInvoiceItemsFromQuoteItems([
      { description: "Website build", quantity: 1, once_off_cents: 150000, sort_order: 0 },
      { description: "SEO setup", quantity: 2, once_off_cents: 25000, sort_order: 1 },
    ], 200000)).toEqual([
      { description: "Website build", quantity: 1, unit_amount_cents: 150000, sort_order: 0 },
      { description: "SEO setup", quantity: 2, unit_amount_cents: 25000, sort_order: 1 },
    ]);
  });

  it("skips monthly-only quote items for the once-off invoice", () => {
    expect(buildOnceOffInvoiceItemsFromQuoteItems([
      { description: "Monthly hosting", quantity: 1, once_off_cents: 0, sort_order: 0 },
      { description: "Launch setup", quantity: 1, once_off_cents: 50000, sort_order: 1 },
    ], 50000)).toEqual([
      { description: "Launch setup", quantity: 1, unit_amount_cents: 50000, sort_order: 1 },
    ]);
  });

  it("throws when once-off invoice items do not match the quote once-off total", () => {
    expect(() => buildOnceOffInvoiceItemsFromQuoteItems([
      { description: "Launch setup", quantity: 1, once_off_cents: 50000, sort_order: 0 },
    ], 60000)).toThrow("does not match quote once-off total");
  });
});
