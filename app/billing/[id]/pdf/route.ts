import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { dateShort, money } from "@/lib/format";
import { simplePdf } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: invoice } = await getSupabaseAdmin().from("invoices").select("*").eq("id", id).single();
  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
  const pdf = simplePdf(`Invoice ${invoice.invoice_number}`, [
    `Status: ${invoice.status}`,
    `Amount: ${money(invoice.amount_cents)}`,
    `Due date: ${dateShort(invoice.due_date)}`,
    invoice.quote_id ? `Based on quote: ${invoice.quote_id}` : "Custom invoice",
    "Payment details are managed in Rapid Rise OS settings.",
  ]);
  return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${invoice.invoice_number}.pdf"` } });
}
