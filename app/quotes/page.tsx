import { AppShell } from "@/components/app-shell";
import { AcceptQuoteButton, QuoteForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { BarList, DeckCard, PanelHeader } from "@/components/command-deck";
import { DonutChart } from "@/components/deck-charts";
import { genericList, listClients, listLeads, listServices } from "@/lib/data";
import { money } from "@/lib/format";
import { distribution } from "@/lib/deck-metrics";
import type { Quote } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function Quotes() {
  await requirePagePermission(permissions.quotesRead);
  const [quotes, clients, leads, services] = await Promise.all([
    genericList<Quote>("quotes"),
    listClients(),
    listLeads(),
    listServices(),
  ]);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Sales"
        title="Quotes"
        description="Keep the main screen focused on pipeline metrics. Create detailed multi-line quotes in a pop-up when needed."
        actions={
          <ModalPanel title="Create quote" triggerLabel="Add quote">
            <QuoteForm clients={clients} leads={leads} services={services} />
          </ModalPanel>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Total quotes", quotes.length],
            [
              "Quoted once-off",
              money(
                quotes.reduce(
                  (sum, quote) => sum + quote.once_off_total_cents,
                  0,
                ),
              ),
            ],
            [
              "Quoted monthly",
              money(
                quotes.reduce(
                  (sum, quote) => sum + quote.monthly_total_cents,
                  0,
                ),
              ),
            ],
            [
              "Accepted",
              quotes.filter((quote) => quote.status === "ACCEPTED").length,
            ],
            [
              "Follow-up due",
              quotes.filter((quote) => quote.status === "FOLLOW_UP_DUE").length,
            ],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        {quotes.length ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <DeckCard padding="p-4"><PanelHeader title="Quotes by Status" /><div className="mt-3"><BarList items={distribution(quotes, (quote) => quote.status)} tone="mixed" /></div></DeckCard>
            <DeckCard padding="p-4">
              <PanelHeader title="Outcome" />
              <div className="mt-4">
                <DonutChart
                  centerLabel={String(quotes.length)}
                  centerSub="quotes"
                  segments={[
                    { label: "Accepted", value: quotes.filter((quote) => quote.status === "ACCEPTED").length, color: "var(--deck-pos)" },
                    { label: "Open", value: quotes.filter((quote) => ["DRAFT", "SENT", "VIEWED", "FOLLOW_UP_DUE"].includes(quote.status)).length, color: "var(--deck-accent-copper)" },
                    { label: "Lost", value: quotes.filter((quote) => ["REJECTED", "EXPIRED"].includes(quote.status)).length, color: "var(--deck-neg)" },
                  ].filter((segment) => segment.value > 0)}
                />
              </div>
            </DeckCard>
          </div>
        ) : null}
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Quote pipeline</h2>
          {quotes.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{quote.title}</p>
                      <p className="text-xs text-slate-500">
                        {quote.quote_number}
                      </p>
                    </div>
                    <StatusBadge value={quote.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    Once-off {money(quote.once_off_total_cents)} • Monthly{" "}
                    {money(quote.monthly_total_cents)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-rapid-cyan"
                      href={`/quotes/${quote.id}/pdf`}
                    >
                      PDF
                    </a>
                    <AcceptQuoteButton quote={quote} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No quotes created yet"
              body="Use Add quote to create a database-backed quote with as many line items as needed."
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
