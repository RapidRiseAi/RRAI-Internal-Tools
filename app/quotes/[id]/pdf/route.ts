import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { dateShort, money } from "@/lib/format";
import { brandedPdf } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).single();
  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order");
  const { data: settings } = await supabase.from("company_settings").select("*").eq("id", true).maybeSingle();
  const { data: client } = quote?.client_id ? await supabase.from("clients").select("company_name,primary_email").eq("id", quote.client_id).maybeSingle() : { data: null };
  const { data: lead } = quote?.lead_id ? await supabase.from("leads").select("company_name,email").eq("id", quote.lead_id).maybeSingle() : { data: null };
  if (!quote) return new NextResponse("Quote not found", { status: 404 });
  const pdf = brandedPdf({
    kind: "Quote",
    number: quote.quote_number,
    title: quote.title,
    status: quote.status,
    companyName: settings?.company_name,
    billingEmail: settings?.billing_email,
    clientName: client?.company_name ?? lead?.company_name,
    clientEmail: client?.primary_email ?? lead?.email,
    meta: [`Created: ${dateShort(quote.created_at)}`, `Valid until: ${dateShort(quote.valid_until)}`, `Quote ID: ${quote.quote_number}`],
    items: (items ?? []).map((item) => ({ description: item.description, quantity: item.quantity, onceOff: money(item.once_off_cents), monthly: money(item.monthly_cents) })),
    totals: [`Once-off: ${money(quote.once_off_total_cents)}`, `Monthly: ${money(quote.monthly_total_cents)}`, "Excludes custom changes not listed above"],
    footer: settings?.quote_footer,
  });
  return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${quote.quote_number}.pdf"` } });
}
