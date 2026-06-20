import { AppShell } from "@/components/app-shell";
import { RecordResourceLink } from "@/components/record-resource-link";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listLeads, recentActivity } from "@/lib/data";
import { dateShort, money } from "@/lib/format";
import type { Invoice, Project, Quote, Retainer, SupportTicket, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePagePermission(permissions.dashboard);
  const [leads, quotes, projects, tasks, tickets, retainers, invoices, activity] = await Promise.all([
    // Dashboard lead metrics are operational snapshots, so listLeads() intentionally excludes archived and converted leads.
    listLeads(),
    genericList<Quote>("quotes"),
    genericList<Project>("projects"),
    genericList<Task>("tasks"),
    genericList<SupportTicket>("support_tickets"),
    genericList<Retainer>("retainers"),
    genericList<Invoice>("invoices"),
    recentActivity(8),
  ]);
  const weekAgo = Date.now() - 7 * 86400000;
  const cards: [string, string | number][] = [
    ["Leads this week", leads.filter((lead) => new Date(lead.created_at).getTime() >= weekAgo).length],
    ["Follow-ups due", leads.filter((lead) => lead.follow_up_date && new Date(lead.follow_up_date) <= new Date()).length],
    ["Quotes in progress", quotes.filter((quote) => ["DRAFT", "SENT", "VIEWED", "FOLLOW_UP_DUE"].includes(quote.status)).length],
    ["Accepted quotes", quotes.filter((quote) => quote.status === "ACCEPTED").length],
    ["Active projects", projects.filter((project) => project.status !== "COMPLETED").length],
    ["Waiting for client", projects.filter((project) => project.status === "WAITING_FOR_CLIENT_INFO").length],
    ["Overdue tasks", tasks.filter((task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE").length],
    ["Open tickets", tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length],
    ["MRR", money(retainers.filter((retainer) => retainer.status === "ACTIVE").reduce((total, retainer) => total + retainer.monthly_amount_cents, 0))],
    ["Outstanding", money(invoices.filter((invoice) => ["SENT", "OVERDUE"].includes(invoice.status)).reduce((total, invoice) => total + invoice.amount_cents, 0))],
  ];

  return (
    <AppShell>
      <PageHeader eyebrow="Command center" title="Today at Rapid Rise AI" description="Live Supabase-backed priorities across sales, delivery, finance, support and referrals." actions={<a href="/reports" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">Open reports</a>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value]) => <Card key={label}><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold text-white">{value}</p></Card>)}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card><h2 className="text-lg font-semibold">Recent activity</h2><div className="mt-4 grid gap-3">{activity.map((item) => <RecordResourceLink key={item.id} title={item.message} eyebrow={item.action} meta={dateShort(item.created_at)} className="border border-white/10 bg-slate-950/50"><div className="grid gap-3 text-sm text-slate-300"><StatusBadge value={item.action} /><p className="whitespace-pre-wrap">{item.message}</p><p className="text-xs text-slate-500">{dateShort(item.created_at)}</p></div></RecordResourceLink>)}</div></Card>
        <Card><h2 className="text-lg font-semibold">Vercel + Supabase deployment</h2><ul className="mt-4 grid gap-3 text-sm text-slate-300"><li>Uses Supabase service role only in server actions/server components.</li><li>Public anon key is reserved for future client-side features.</li><li>Database tables are defined in versioned Supabase SQL migrations.</li><li>Every major record has status, timestamps and activity history hooks.</li></ul></Card>
      </div>
    </AppShell>
  );
}
