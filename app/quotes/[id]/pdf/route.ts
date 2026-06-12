import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { simplePdf } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).single();
  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order");
  if (!quote) return new NextResponse("Quote not found", { status: 404 });
  const pdf = simplePdf(`Quote ${quote.quote_number}`, [
    quote.title,
    `Status: ${quote.status}`,
    `Once-off total: ${money(quote.once_off_total_cents)}`,
    `Monthly total: ${money(quote.monthly_total_cents)}`,
    ...(items ?? []).map((item) => `${item.description} x${item.quantity}: ${money(item.once_off_cents)} once-off, ${money(item.monthly_cents)} monthly`),
  ]);
  return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${quote.quote_number}.pdf"` } });
}
