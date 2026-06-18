export type PaymentState = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type CommissionState = "PENDING" | "APPROVED" | "PAYABLE" | "PAID" | "CANCELLED" | "DISPUTED";

export function nextCommissionStatus(current: CommissionState, paymentStatus: PaymentState): CommissionState {
  if (current === "PAID" || current === "CANCELLED" || current === "DISPUTED") return current;
  if (paymentStatus === "PAID") return "PAYABLE";
  return current === "PAYABLE" ? "APPROVED" : current;
}

export function calculateCommissionCents(paymentCents: number, ratePercent: number) {
  if (paymentCents < 0) throw new Error("paymentCents cannot be negative");
  if (ratePercent < 0 || ratePercent > 100) throw new Error("ratePercent must be between 0 and 100");
  return Math.round(paymentCents * (ratePercent / 100));
}


export type QuoteItemForInvoice = {
  description: string;
  quantity: number;
  once_off_cents: number;
  sort_order?: number | null;
};

export type InvoiceItemFromQuote = {
  description: string;
  quantity: number;
  unit_amount_cents: number;
  sort_order: number;
};

export function buildOnceOffInvoiceItemsFromQuoteItems(quoteItems: QuoteItemForInvoice[], expectedTotalCents: number): InvoiceItemFromQuote[] {
  if (expectedTotalCents < 0) throw new Error("expectedTotalCents cannot be negative");

  const invoiceItems = quoteItems
    .filter((item) => item.once_off_cents > 0)
    .map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unit_amount_cents: item.once_off_cents,
      sort_order: item.sort_order ?? index,
    }));

  const actualTotalCents = invoiceItems.reduce((sum, item) => sum + item.quantity * item.unit_amount_cents, 0);
  if (actualTotalCents !== expectedTotalCents) {
    throw new Error(`Once-off invoice item total (${actualTotalCents}) does not match quote once-off total (${expectedTotalCents}).`);
  }

  return invoiceItems;
}
