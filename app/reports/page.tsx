import { AppShell } from "@/components/app-shell";
import { requirePagePermission } from "@/lib/auth";
import { labelize, permissions } from "@/lib/constants";
import { BarList, DeckCard, PanelHeader } from "@/components/command-deck";
import { DonutChart, LineChart } from "@/components/deck-charts";
import { genericList, listAllLeadsForReporting, listPayments } from "@/lib/data";
import { money } from "@/lib/format";
import { compactMoney, lastNWeekStarts, monthDayShort, pct, weeklyTotals } from "@/lib/deck-metrics";
import type { Expense, Invoice, Payment, Project, Quote, Retainer, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

function countBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label: labelize(label), value })).sort((a, b) => b.value - a.value);
}

export default async function Reports() {
  await requirePagePermission(permissions.dashboard);
  // Reporting deliberately includes archived/converted leads so rates reflect the full historical funnel.
  const [leads, quotes, projects, tasks, retainers, invoices, payments, expenses] = await Promise.all([
    listAllLeadsForReporting(),
    genericList<Quote>("quotes"),
    genericList<Project>("projects"),
    genericList<Task>("tasks"),
    genericList<Retainer>("retainers"),
    genericList<Invoice>("invoices"),
    listPayments(),
    genericList<Expense>("expenses", "expense_date"),
  ]);

  const won = leads.filter((lead) => lead.stage === "WON").length;
  const conversion = pct(won, leads.length);
  const closedRevenue = invoices.filter((invoice) => invoice.status === "PAID").reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const outstanding = invoices.filter((invoice) => ["SENT", "OVERDUE", "PART_PAID"].includes(invoice.status)).reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE").reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const mrr = retainers.filter((retainer) => retainer.status === "ACTIVE").reduce((sum, retainer) => sum + retainer.monthly_amount_cents, 0);
  const totalQuoted = quotes.reduce((sum, quote) => sum + quote.once_off_total_cents + quote.monthly_total_cents, 0);
  const avgQuote = quotes.length ? Math.round(quotes.reduce((sum, quote) => sum + quote.once_off_total_cents, 0) / quotes.length) : 0;

  const stats: [string, string][] = [
    ["Conversion rate", `${conversion}%`],
    ["Closed revenue", money(closedRevenue)],
    ["Outstanding", money(outstanding)],
    ["MRR", money(mrr)],
    ["Total quoted", money(totalQuoted)],
    ["Average quote", money(avgQuote)],
  ];

  const weeks = lastNWeekStarts(12);
  const revenueSeries = weeklyTotals(payments.filter((payment) => payment.status === "PAID") as Payment[], (p) => p.paid_at, (p) => p.amount_cents, weeks);
  const expenseSeries = weeklyTotals(expenses, (e) => e.expense_date, (e) => e.amount_cents, weeks);
  const chartMax = Math.max(1, ...revenueSeries, ...expenseSeries);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => compactMoney(chartMax * fraction));
  const xLabels = weeks.filter((_, index) => index % 2 === 0).map(monthDayShort);

  const invoiceSegments = [
    { label: "Paid", value: invoices.filter((i) => i.status === "PAID").length, color: "var(--deck-pos)" },
    { label: "Outstanding", value: invoices.filter((i) => ["SENT", "PART_PAID"].includes(i.status)).length, color: "var(--deck-accent-copper)" },
    { label: "Overdue", value: invoices.filter((i) => i.status === "OVERDUE").length, color: "var(--deck-neg)" },
  ].filter((segment) => segment.value > 0);

  const leadsByStage = countBy(leads, (lead) => lead.stage);
  const projectsByStatus = countBy(projects, (project) => project.status);
  const tasksByStatus = countBy(tasks, (task) => task.status);
  const quotesByStatus = countBy(quotes, (quote) => quote.status);

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-accent-cyan">Analytics</p>
          <h1 className="font-display text-xl font-bold tracking-tight text-deck-text">Reports</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map(([label, value]) => (
            <DeckCard key={label} padding="p-3">
              <p className="font-display text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-deck-muted">{label}</p>
              <p className="mt-1.5 font-mono text-xl font-bold text-deck-text">{value}</p>
            </DeckCard>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <DeckCard padding="p-4" className="flex flex-col">
            <PanelHeader title="Revenue vs Expenses" right={<span className="font-mono text-xs text-deck-muted">12 weeks</span>} />
            <div className="mt-1.5 flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-deck-muted"><span className="h-0.5 w-4 rounded-full bg-accent-cyan" /> Revenue</span>
              <span className="inline-flex items-center gap-1.5 text-deck-muted"><span className="h-0.5 w-4 rounded-full bg-accent-copper" /> Expenses</span>
            </div>
            <div className="mt-3 h-52">
              <LineChart series={[{ name: "Revenue", values: revenueSeries, tone: "cyan" }, { name: "Expenses", values: expenseSeries, tone: "copper" }]} labels={xLabels} yTicks={yTicks} />
            </div>
          </DeckCard>

          <DeckCard padding="p-4" className="flex flex-col">
            <PanelHeader title="Invoices" right={<span className="font-mono text-xs text-neg">{money(overdue)} overdue</span>} />
            <div className="mt-4">
              {invoiceSegments.length ? <DonutChart segments={invoiceSegments} centerLabel={String(invoices.length)} centerSub="invoices" /> : <p className="py-8 text-center text-sm text-deck-muted">No invoices yet.</p>}
            </div>
          </DeckCard>
        </div>

        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
          <DeckCard padding="p-4"><PanelHeader title="Leads by Stage" /><div className="mt-3"><BarList items={leadsByStage} tone="mixed" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="Projects by Status" /><div className="mt-3"><BarList items={projectsByStatus} tone="cyan" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="Tasks by Status" /><div className="mt-3"><BarList items={tasksByStatus} tone="copper" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="Quotes by Status" /><div className="mt-3"><BarList items={quotesByStatus} tone="mixed" /></div></DeckCard>
        </div>
      </div>
    </AppShell>
  );
}
