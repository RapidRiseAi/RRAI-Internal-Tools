import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import { money } from "@/lib/format";
import type { Invoice } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Billing() { const invoices = await genericList<Invoice>("invoices"); const paid = invoices.filter((invoice) => invoice.status === "PAID").reduce((sum, invoice) => sum + invoice.amount_cents, 0); const outstanding = invoices.filter((invoice) => ["SENT", "OVERDUE"].includes(invoice.status)).reduce((sum, invoice) => sum + invoice.amount_cents, 0); return <AppShell><ModulePage eyebrow="Finance" title="Billing" description="Invoices, payment tracking, overdue amounts, once-off project revenue and recurring revenue reporting." metrics={[["Invoices", invoices.length], ["Paid", money(paid)], ["Outstanding", money(outstanding)], ["Overdue", invoices.filter((invoice) => invoice.status === "OVERDUE").length], ["Draft", invoices.filter((invoice) => invoice.status === "DRAFT").length]]} records={invoices.map((invoice) => ({ id: invoice.id, title: invoice.invoice_number, subtitle: invoice.client_id, status: invoice.status, value: money(invoice.amount_cents) }))} emptyTitle="No invoice records yet" /></AppShell>; }
