import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import { money } from "@/lib/format";
import type { Quote } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Quotes() { const quotes = await genericList<Quote>("quotes"); return <AppShell><ModulePage eyebrow="Sales" title="Quotes" description="Quote builder foundation with statuses, line items, once-off pricing, monthly pricing and quote-to-project conversion model." metrics={[["Total quotes", quotes.length], ["Quoted once-off", money(quotes.reduce((sum, quote) => sum + quote.once_off_total_cents, 0))], ["Quoted monthly", money(quotes.reduce((sum, quote) => sum + quote.monthly_total_cents, 0))], ["Accepted", quotes.filter((quote) => quote.status === "ACCEPTED").length], ["Follow-up due", quotes.filter((quote) => quote.status === "FOLLOW_UP_DUE").length]]} records={quotes.map((quote) => ({ id: quote.id, title: quote.title, subtitle: quote.quote_number, status: quote.status, value: money(quote.once_off_total_cents + quote.monthly_total_cents) }))} emptyTitle="No quotes created yet" /></AppShell>; }
