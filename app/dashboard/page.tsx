import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Receipt,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import {
  DatePill,
  DeckCard,
  Funnel,
  KpiCard,
  ListPanel,
  ListRow,
  PanelHeader,
  ProgressBar,
  type Tone,
} from "@/components/command-deck";
import { LineChart } from "@/components/deck-charts";
import { RangeControl } from "@/components/range-control";
import { genericList, listAllLeadsForReporting, listClients, listPayments, recentActivity } from "@/lib/data";
import { dateShort, money } from "@/lib/format";
import { compactMoney, deltaTrend, isInMonthOffset, lastNWeekStarts, monthDayShort, pct, weeklyTotals } from "@/lib/deck-metrics";
import type { Expense, Invoice, Payment, Project, Quote, Retainer, SupportTicket, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

const openQuoteStatuses = ["DRAFT", "SENT", "VIEWED", "FOLLOW_UP_DUE"];
const openInvoiceStatuses = ["SENT", "OVERDUE", "PART_PAID"];

const entityIcon: Record<string, LucideIcon> = {
  lead: Target,
  client: Building2,
  project: BriefcaseBusiness,
  task: ClipboardCheck,
  quote: FileText,
  invoice: CircleDollarSign,
  payment: CircleDollarSign,
  expense: Receipt,
};

function dueTone(dateStr: string): Tone {
  const time = new Date(dateStr).getTime();
  const now = Date.now();
  if (time < now) return "neg";
  if (time < now + 3 * 86_400_000) return "copper";
  return "neutral";
}

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission(permissions.dashboard);
  const params = (await searchParams) ?? {};
  const rangeParam = typeof params.range === "string" ? params.range : "8";
  const weeks = rangeParam === "4" ? 4 : rangeParam === "12" ? 12 : 8;

  const [projects, tasks, quotes, payments, invoices, expenses, retainers, tickets, clients, leads, activity] = await Promise.all([
    genericList<Project>("projects"),
    genericList<Task>("tasks"),
    genericList<Quote>("quotes"),
    listPayments(),
    genericList<Invoice>("invoices"),
    genericList<Expense>("expenses", "expense_date"),
    genericList<Retainer>("retainers"),
    genericList<SupportTicket>("support_tickets"),
    listClients(),
    listAllLeadsForReporting(),
    recentActivity(7),
  ]);

  // --- KPI cards -----------------------------------------------------------
  const activeProjects = projects.filter((project) => project.status !== "COMPLETED").length;
  const openTasks = tasks.filter((task) => !["DONE", "SCRAPPED"].includes(task.status)).length;

  const openQuoteValue = quotes.filter((quote) => openQuoteStatuses.includes(quote.status)).reduce((sum, quote) => sum + quote.once_off_total_cents + quote.monthly_total_cents, 0);
  const totalQuoteValue = quotes.reduce((sum, quote) => sum + quote.once_off_total_cents + quote.monthly_total_cents, 0);

  const paidInvoiceValue = invoices.filter((invoice) => invoice.status === "PAID").reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const outstandingValue = invoices.filter((invoice) => openInvoiceStatuses.includes(invoice.status)).reduce((sum, invoice) => sum + invoice.amount_cents, 0);

  const paidPayments = (payments as Payment[]).filter((payment) => payment.status === "PAID");
  const revenueThisMonth = paidPayments.filter((payment) => isInMonthOffset(payment.paid_at, 0)).reduce((sum, payment) => sum + payment.amount_cents, 0);
  const revenueLastMonth = paidPayments.filter((payment) => isInMonthOffset(payment.paid_at, -1)).reduce((sum, payment) => sum + payment.amount_cents, 0);

  const expensesThisMonth = expenses.filter((expense) => isInMonthOffset(expense.expense_date, 0)).reduce((sum, expense) => sum + expense.amount_cents, 0);
  const expensesLastMonth = expenses.filter((expense) => isInMonthOffset(expense.expense_date, -1)).reduce((sum, expense) => sum + expense.amount_cents, 0);
  const recurringExpenseValue = expenses.filter((expense) => expense.recurrence !== "NONE").reduce((sum, expense) => sum + expense.amount_cents, 0);
  const totalExpenseValue = expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);

  // --- Revenue vs expenses line chart -------------------------------------
  const weekStarts = lastNWeekStarts(weeks);
  const revenueSeries = weeklyTotals(paidPayments, (payment) => payment.paid_at, (payment) => payment.amount_cents, weekStarts);
  const expenseSeries = weeklyTotals(expenses, (expense) => expense.expense_date, (expense) => expense.amount_cents, weekStarts);
  const chartMax = Math.max(1, ...revenueSeries, ...expenseSeries);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => compactMoney(chartMax * fraction));
  const xLabels = weekStarts.filter((_, index) => index % Math.ceil(weeks / 6) === 0).map(monthDayShort);

  // --- Lead pipeline funnel (cumulative "reached at least" across real stages) ---
  const pipelineOrder = ["NEW_LEAD", "CONTACTED", "REPLIED", "DISCOVERY_NEEDED", "DISCOVERY_COMPLETED", "QUOTE_NEEDED", "QUOTE_SENT", "NEGOTIATING", "WON"];
  const stageIndex = (stage: string) => pipelineOrder.indexOf(stage);
  const pipelineLeads = leads.filter((lead) => stageIndex(lead.stage) >= 0);
  const funnelGroups = [
    { label: "New leads", min: 0 },
    { label: "Contacted", min: 1 },
    { label: "Discovery", min: 3 },
    { label: "Quoted", min: 5 },
    { label: "Negotiating", min: 7 },
    { label: "Won", min: 8 },
  ];
  const funnelCounts = funnelGroups.map((group) => pipelineLeads.filter((lead) => stageIndex(lead.stage) >= group.min).length);
  const funnelTop = funnelCounts[0] || 1;
  const funnelStages = funnelGroups.map((group, index) => ({
    label: group.label,
    count: funnelCounts[index],
    pct: pct(funnelCounts[index], funnelTop),
    conv: index === 0 ? null : pct(funnelCounts[index], funnelCounts[index - 1] || 1),
  }));
  const lostLeads = leads.filter((lead) => lead.stage === "LOST").length;

  // --- Upcoming deadlines (unified, next items first) ----------------------
  const clientName = (id: string | null) => clients.find((client) => client.id === id)?.company_name ?? "Internal";
  type Deadline = { id: string; title: string; subtitle: string; date: string; icon: LucideIcon; tone: Tone; href: string; progress?: number };
  const deadlines: Deadline[] = [
    ...projects.filter((project) => project.deadline && project.status !== "COMPLETED").map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      subtitle: clientName(project.client_id),
      date: project.deadline!,
      icon: BriefcaseBusiness,
      tone: "cyan" as Tone,
      href: `/projects/${project.id}`,
      progress: project.progress,
    })),
    ...invoices.filter((invoice) => invoice.due_date && openInvoiceStatuses.includes(invoice.status)).map((invoice) => ({
      id: `invoice-${invoice.id}`,
      title: `Invoice ${invoice.invoice_number}`,
      subtitle: `${clientName(invoice.client_id)} · ${money(invoice.amount_cents)}`,
      date: invoice.due_date!,
      icon: CircleDollarSign,
      tone: "copper" as Tone,
      href: "/billing",
    })),
    ...tasks.filter((task) => task.due_date && !["DONE", "SCRAPPED"].includes(task.status)).map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      subtitle: task.assignee?.name ?? "Unassigned",
      date: task.due_date!,
      icon: ClipboardCheck,
      tone: "neutral" as Tone,
      href: `/tasks/${task.id}`,
    })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  // --- Secondary operational stats ----------------------------------------
  const activeMrr = retainers.filter((retainer) => retainer.status === "ACTIVE").reduce((sum, retainer) => sum + retainer.monthly_amount_cents, 0);
  const openTickets = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const secondaryStats: [string, string | number][] = [
    ["Active clients", clients.length],
    ["Monthly recurring", money(activeMrr)],
    ["Open tickets", openTickets],
    ["Outstanding", money(outstandingValue)],
  ];

  const revenueTrend = deltaTrend(revenueThisMonth, revenueLastMonth, true);
  const expenseTrend = deltaTrend(expensesThisMonth, expensesLastMonth, false);

  return (
    <AppShell>
      <div className="flex h-full flex-col gap-3">
        {/* Title + secondary stat chips */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-accent-cyan">Command deck</p>
            <h1 className="font-display text-xl font-bold tracking-tight text-deck-text">Business Control Panel</h1>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            {secondaryStats.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-hairline bg-deck-panel/60 px-3 py-1.5">
                <p className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-deck-muted">{label}</p>
                <p className="font-mono text-sm font-bold text-deck-text">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* KPI rings */}
        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard dense label="Active Projects" value={activeProjects} total={projects.length} ringValue={pct(activeProjects, projects.length)} href="/projects" />
          <KpiCard dense label="Open Tasks" value={openTasks} total={tasks.length} ringValue={pct(openTasks, tasks.length)} href="/tasks" />
          <KpiCard dense label="Pipeline" value={compactMoney(openQuoteValue)} total={compactMoney(totalQuoteValue)} ringValue={pct(openQuoteValue, totalQuoteValue)} href="/quotes" />
          <KpiCard dense label="Revenue · MTD" value={compactMoney(revenueThisMonth)} ringValue={pct(paidInvoiceValue, paidInvoiceValue + outstandingValue)} trend={revenueTrend ?? undefined} href="/billing" />
          <KpiCard dense label="Expenses · MTD" value={compactMoney(expensesThisMonth)} ringValue={pct(recurringExpenseValue, totalExpenseValue)} trend={expenseTrend ?? undefined} href="/billing" />
        </div>

        {/* Charts + lists fill the rest of the viewport */}
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1.55fr_1fr]">
          <div className="grid min-h-0 grid-rows-[1.5fr_1fr] gap-3">
            <DeckCard className="flex min-h-0 flex-col" padding="p-4">
              <div className="shrink-0">
                <PanelHeader
                  title="Revenue vs Expenses"
                  right={<RangeControl options={[{ value: "8", label: "8 weeks" }, { value: "4", label: "4 weeks" }, { value: "12", label: "12 weeks" }]} />}
                />
                <div className="mt-1.5 flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-deck-muted"><span className="h-0.5 w-4 rounded-full bg-accent-cyan" /> Revenue</span>
                  <span className="inline-flex items-center gap-1.5 text-deck-muted"><span className="h-0.5 w-4 rounded-full bg-accent-copper" /> Expenses</span>
                </div>
              </div>
              <div className="mt-3 min-h-0 flex-1">
                <LineChart series={[{ name: "Revenue", values: revenueSeries, tone: "cyan" }, { name: "Expenses", values: expenseSeries, tone: "copper" }]} labels={xLabels} yTicks={yTicks} />
              </div>
            </DeckCard>

            <ListPanel title="Recent Activity" fill>
              {activity.length ? activity.map((item) => (
                <ListRow
                  key={item.id}
                  icon={entityIcon[item.entity_type?.toLowerCase()] ?? Activity}
                  iconTone="cyan"
                  title={item.message}
                  subtitle={item.action.replaceAll("_", " ").toLowerCase()}
                  trailing={<span className="font-mono text-xs text-deck-muted">{dateShort(item.created_at)}</span>}
                />
              )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No activity recorded yet.</div>}
            </ListPanel>
          </div>

          <div className="grid min-h-0 grid-rows-[1.1fr_1fr] gap-3">
            <DeckCard className="flex min-h-0 flex-col" padding="p-4">
              <div className="shrink-0">
                <PanelHeader title="Lead Pipeline" right={<span className="font-mono text-xs text-deck-muted">{lostLeads} lost</span>} />
                <p className="mt-0.5 text-xs text-deck-muted">Reached at least each stage</p>
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                {funnelTop > 1 || funnelCounts[0] > 0 ? <Funnel stages={funnelStages} /> : <p className="py-8 text-center text-sm text-deck-muted">No pipeline leads yet.</p>}
              </div>
            </DeckCard>

            <ListPanel title="Upcoming Deadlines" fill viewAllHref="/calendar" viewAllLabel="Open calendar">
              {deadlines.length ? deadlines.map((item) => (
                <ListRow
                  key={item.id}
                  icon={item.icon}
                  iconTone={item.tone}
                  title={item.title}
                  subtitle={item.subtitle}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <DatePill date={dateShort(item.date)} tone={dueTone(item.date)} />
                      {item.progress != null ? <div className="w-20"><ProgressBar value={item.progress} /></div> : null}
                    </div>
                  }
                  href={item.href}
                />
              )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">Nothing due soon.</div>}
            </ListPanel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
