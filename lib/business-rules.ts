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
