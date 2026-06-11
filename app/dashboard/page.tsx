import { AppShell } from "@/components/app-shell";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateShort, money } from "@/lib/format";

export default async function DashboardPage() {
  const [leadsWeek, followUps, quotes, acceptedQuotes, activeProjects, waitingProjects, overdueTasks, tickets, retainers, invoices, commissions, activity] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, archivedAt: null } }),
    prisma.lead.count({ where: { followUpDate: { lte: new Date() }, archivedAt: null } }),
    prisma.quote.count({ where: { status: { in: ["DRAFT", "SENT", "VIEWED", "FOLLOW_UP_DUE"] } } }),
    prisma.quote.count({ where: { status: "ACCEPTED", acceptedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    prisma.project.count({ where: { status: { notIn: ["COMPLETED"] } } }),
    prisma.project.count({ where: { status: "WAITING_FOR_CLIENT_INFO" } }),
    prisma.task.count({ where: { dueDate: { lt: new Date() }, status: { not: "DONE" } } }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.retainer.aggregate({ _sum: { monthlyAmountCents: true }, where: { status: "ACTIVE" } }),
    prisma.invoice.aggregate({ _sum: { amountCents: true }, where: { status: { in: ["SENT", "OVERDUE"] } } }),
    prisma.commission.aggregate({ _sum: { amountCents: true }, where: { status: { in: ["APPROVED", "PAYABLE"] } } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
  ]);
  const cards = [
    ["Leads this week", leadsWeek], ["Follow-ups due", followUps], ["Quotes in progress", quotes], ["Accepted this month", acceptedQuotes], ["Active projects", activeProjects], ["Waiting for client", waitingProjects], ["Overdue tasks", overdueTasks], ["Open tickets", tickets], ["MRR", money(retainers._sum.monthlyAmountCents ?? 0)], ["Outstanding", money(invoices._sum.amountCents ?? 0)], ["Commission owed", money(commissions._sum.amountCents ?? 0)],
  ];
  return <AppShell><PageHeader eyebrow="Command center" title="Today at Rapid Rise AI" description="Live database-backed priorities across sales, delivery, finance, support and referrals." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label as string}><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold text-white">{value}</p></Card>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]"><Card><h2 className="text-lg font-semibold">Recent activity</h2><div className="mt-4 grid gap-3">{activity.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/50 p-3"><div><StatusBadge value={item.action} /><p className="mt-2 text-sm text-slate-200">{item.message}</p><p className="text-xs text-slate-500">{item.actor?.name ?? "System"}</p></div><p className="text-xs text-slate-500">{dateShort(item.createdAt)}</p></div>)}</div></Card><Card><h2 className="text-lg font-semibold">Operating principles</h2><ul className="mt-4 grid gap-3 text-sm text-slate-300"><li>Every record has an owner, status and next action.</li><li>Lead conversions create client records and timeline activity.</li><li>Commissions become payable only when linked payment is paid.</li><li>Employees receive scoped access through roles and permissions.</li></ul></Card></div></AppShell>;
}
