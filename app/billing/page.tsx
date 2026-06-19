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
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients, listPayments } from "@/lib/data";
import { markExpensePaid } from "@/lib/actions";
import { dateShort, money } from "@/lib/format";
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
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
            <div className="grid gap-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-sm text-slate-400">
                      Due {dateShort(invoice.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-rapid-cyan"
                      href={`/billing/${invoice.id}/pdf`}
                    >
                      PDF
                    </a>
                    <p>{money(invoice.amount_cents)}</p>
                    <StatusBadge value={invoice.status} />
                  </div>
                </div>
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
