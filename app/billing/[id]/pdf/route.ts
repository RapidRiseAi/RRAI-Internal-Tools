import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { dateShort, money } from "@/lib/format";
import { brandedPdf } from "@/lib/pdf";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePagePermission(permissions.billingRead);
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
  const { data: client } = await supabase
    .from("clients")
    .select("company_name,primary_email")
    .eq("id", invoice.client_id)
    .maybeSingle();
  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const { data: invoiceItems } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");
  const paymentDetails = [
    settings?.bank_name ? `Bank: ${settings.bank_name}` : null,
    settings?.bank_account_name
      ? `Account: ${settings.bank_account_name}`
      : null,
    settings?.bank_account_number
      ? `Number: ${settings.bank_account_number}`
      : null,
    settings?.bank_branch_code ? `Branch: ${settings.bank_branch_code}` : null,
    settings?.payment_terms ?? null,
  ].filter(Boolean) as string[];
  const pdf = brandedPdf({
    kind: "Invoice",
    number: invoice.invoice_number,
    title: `Invoice ${invoice.invoice_number}`,
    status: invoice.status,
    companyName: settings?.company_name,
    billingEmail: settings?.billing_email,
    clientName: client?.company_name,
    clientEmail: client?.primary_email,
    meta: [
      `Issued: ${dateShort(invoice.issued_at)}`,
      `Due: ${dateShort(invoice.due_date)}`,
      invoice.quote_id ? `Quote: ${invoice.quote_id}` : "Custom invoice",
    ],
    items: invoiceItems?.length
      ? invoiceItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          amount: money(item.unit_amount_cents),
          status: money(item.quantity * item.unit_amount_cents),
        }))
      : [
          {
            description: invoice.quote_id
              ? "Accepted quote invoice"
              : "Professional services",
            amount: money(invoice.amount_cents),
            status: invoice.status,
          },
        ],
    totals: [
      `Total due: ${money(invoice.amount_cents)}`,
      `Due date: ${dateShort(invoice.due_date)}`,
      `Status: ${invoice.status}`,
    ],
    footer: settings?.invoice_footer,
    paymentDetails,
  });
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
