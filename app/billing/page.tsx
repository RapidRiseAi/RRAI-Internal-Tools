import { AppShell } from "@/components/app-shell";
import {
  DeleteExpenseForm,
  ExpenseForm,
  InvoiceForm,
  PaymentForm,
  RetainerForm,
  VendorForm,
} from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { RecordResourceLink } from "@/components/record-resource-link";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { BarList, DeckCard, PanelHeader } from "@/components/command-deck";
import { DonutChart, LineChart } from "@/components/deck-charts";
import { genericList, listClients, listPayments } from "@/lib/data";
import { markExpensePaid } from "@/lib/actions";
import { dateShort, money } from "@/lib/format";
import { compactMoney, distribution, lastNWeekStarts, monthDayShort, weeklyTotals } from "@/lib/deck-metrics";
import type {
  Expense,
  Invoice,
  Payment,
  Project,
  Quote,
  QuoteItem,
  Retainer,
  Vendor,
} from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function Billing() {
  await requirePagePermission(permissions.billingRead);
  const [
    invoices,
    clients,
    payments,
    quotes,
    quoteItems,
    retainers,
    expenses,
    projects,
    vendors,
  ] = await Promise.all([
    genericList<Invoice>("invoices"),
    listClients(),
    listPayments(),
    genericList<Quote>("quotes"),
    genericList<QuoteItem>("quote_items", "sort_order"),
    genericList<Retainer>("retainers"),
    genericList<Expense>("expenses", "expense_date"),
    genericList<Project>("projects"),
    genericList<Vendor>("vendors", "name"),
  ]);
  const paid = invoices
    .filter((invoice) => invoice.status === "PAID")
    .reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const outstanding = invoices
    .filter((invoice) =>
      ["SENT", "OVERDUE", "PART_PAID"].includes(invoice.status),
    )
    .reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const activeMrr = retainers
    .filter((retainer) => retainer.status === "ACTIVE")
    .reduce((sum, retainer) => sum + retainer.monthly_amount_cents, 0);
  const expenseTotal = expenses.reduce(
    (sum, expense) => sum + expense.amount_cents,
    0,
  );
  const monthlyRecurringExpenses = expenses
    .filter((expense) => expense.recurrence !== "NONE")
    .reduce((sum, expense) => sum + expense.amount_cents, 0);

  const weeks = lastNWeekStarts(12);
  const revenueSeries = weeklyTotals((payments as Payment[]).filter((payment) => payment.status === "PAID"), (payment) => payment.paid_at, (payment) => payment.amount_cents, weeks);
  const expenseSeries = weeklyTotals(expenses, (expense) => expense.expense_date, (expense) => expense.amount_cents, weeks);
  const chartMax = Math.max(1, ...revenueSeries, ...expenseSeries);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => compactMoney(chartMax * fraction));
  const xLabels = weeks.filter((_, index) => index % 2 === 0).map(monthDayShort);
  const invoiceSegments = [
    { label: "Paid", value: invoices.filter((invoice) => invoice.status === "PAID").length, color: "var(--deck-pos)" },
    { label: "Outstanding", value: invoices.filter((invoice) => ["SENT", "PART_PAID"].includes(invoice.status)).length, color: "var(--deck-accent-copper)" },
    { label: "Overdue", value: invoices.filter((invoice) => invoice.status === "OVERDUE").length, color: "var(--deck-neg)" },
  ].filter((segment) => segment.value > 0);
  const expenseByCategory = distribution(expenses, (expense) => expense.category);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Finance"
        title="Billing, retainers & expenses"
        description="One finance workspace for invoices, recurring revenue and costs. Actions stay in focused pop-ups instead of crowding the page."
        actions={
          <>
            <ModalPanel title="Create invoice" triggerLabel="Add invoice">
              <InvoiceForm
                clients={clients}
                quotes={quotes}
                quoteItems={quoteItems}
              />
            </ModalPanel>
            <ModalPanel
              title="Record payment"
              triggerLabel="Record payment"
              variant="ghost"
            >
              <PaymentForm invoices={invoices} />
            </ModalPanel>
            <ModalPanel
              title="Create retainer"
              triggerLabel="Add retainer"
              variant="ghost"
            >
              <RetainerForm clients={clients} />
            </ModalPanel>
            <ModalPanel title="Add vendor" triggerLabel="Add vendor" variant="ghost">
              <VendorForm />
            </ModalPanel>
            <ModalPanel
              title="Record expense"
              triggerLabel="Add expense"
              variant="ghost"
            >
              <ExpenseForm clients={clients} projects={projects} vendors={vendors} />
            </ModalPanel>
          </>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Paid", money(paid)],
            ["Outstanding", money(outstanding)],
            ["Active MRR", money(activeMrr)],
            ["Expenses", money(expenseTotal)],
            ["Monthly costs", money(monthlyRecurringExpenses)],
            ["Payments", payments.length],
            ["Vendors", vendors.length],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <DeckCard padding="p-4" className="flex flex-col">
            <PanelHeader title="Revenue vs Expenses" right={<span className="font-mono text-xs text-deck-muted">12 weeks</span>} />
            <div className="mt-1.5 flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-deck-muted"><span className="h-0.5 w-4 rounded-full bg-accent-cyan" /> Revenue</span>
              <span className="inline-flex items-center gap-1.5 text-deck-muted"><span className="h-0.5 w-4 rounded-full bg-accent-copper" /> Expenses</span>
            </div>
            <div className="mt-3 h-44">
              <LineChart series={[{ name: "Revenue", values: revenueSeries, tone: "cyan" }, { name: "Expenses", values: expenseSeries, tone: "copper" }]} labels={xLabels} yTicks={yTicks} />
            </div>
          </DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="Invoices" />{invoiceSegments.length ? <div className="mt-4"><DonutChart segments={invoiceSegments} centerLabel={String(invoices.length)} centerSub="invoices" /></div> : <p className="mt-4 text-sm text-deck-muted">No invoices yet.</p>}</DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="Expenses by Category" /><div className="mt-3"><BarList items={expenseByCategory} tone="copper" /></div></DeckCard>
        </div>
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
            <div className="grid gap-3">
              {invoices.map((invoice) => (
                <RecordResourceLink
                  key={invoice.id}
                  title={invoice.invoice_number}
                  eyebrow="Invoice"
                  meta={<span>Due {dateShort(invoice.due_date)} · {money(invoice.amount_cents)} · {invoice.status}</span>}
                  href={`/billing/${invoice.id}/pdf`}
                  actionLabel="Open PDF"
                />
              ))}
            </div>
          </Card>
          <div className="grid gap-6">
            <Card>
              <h2 className="mb-4 text-lg font-semibold">Retainers</h2>
              <div className="grid gap-2">
                {retainers.slice(0, 6).map((retainer) => (
                  <div
                    key={retainer.id}
                    className="rounded-xl bg-white/[0.04] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {retainer.type}
                      </p>
                      <StatusBadge value={retainer.status} />
                    </div>
                    <p className="text-xs text-slate-400">
                      {money(retainer.monthly_amount_cents)} • next{" "}
                      {dateShort(retainer.next_billing_date)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-semibold">Recent payments</h2>
              <div className="grid gap-2">
                {(payments as Payment[]).slice(0, 4).map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl bg-white/[0.04] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {money(payment.amount_cents)}
                      </p>
                      <StatusBadge value={payment.status} />
                    </div>
                    <p className="text-xs text-slate-400">
                      {payment.method ?? "No method"} •{" "}
                      {dateShort(payment.paid_at ?? payment.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Vendors</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="rounded-xl bg-white/[0.04] p-3">
                <p className="font-semibold text-white">{vendor.name}</p>
                <p className="text-sm text-slate-400">
                  {[vendor.category, vendor.email, vendor.phone]
                    .filter(Boolean)
                    .join(" • ") || "No contact details yet"}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Expenses</h2>
          <div className="grid gap-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3"
              >
                <div>
                  <p className="font-semibold text-white">{expense.vendor}</p>
                  <p className="text-sm text-slate-400">
                    {expense.category} • {expense.expense_type ?? "GENERAL"} • {dateShort(expense.expense_date)}
                    {expense.recurrence !== "NONE"
                      ? ` • next ${dateShort(expense.next_due_date)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {expense.recurrence !== "NONE" ? (
                    <StatusBadge value={expense.recurrence} />
                  ) : null}
                  <p>{money(expense.amount_cents)}</p>
                  <StatusBadge value={expense.status} />
                  <ModalPanel title={`Update ${expense.vendor}`} triggerLabel="Update" variant="ghost">
                    <ExpenseForm clients={clients} projects={projects} vendors={vendors} expense={expense} />
                  </ModalPanel>
                  <DeleteExpenseForm expense={expense} />
                  {expense.status !== "PAID" ? (
                    <form action={markExpensePaid}>
                      <input type="hidden" name="id" value={expense.id} />
                      <button className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">
                        Mark paid
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
