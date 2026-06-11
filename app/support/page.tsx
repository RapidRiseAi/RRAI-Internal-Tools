import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import type { SupportTicket } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Support() { const tickets = await genericList<SupportTicket>("support_tickets"); return <AppShell><ModulePage eyebrow="Support" title="Support tickets" description="Ticket queue with categories, priorities, client/project links, assignment-ready workflow and resolution notes." metrics={[["Tickets", tickets.length], ["Open", tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length], ["Urgent", tickets.filter((ticket) => ticket.priority === "URGENT").length], ["Waiting client", tickets.filter((ticket) => ticket.status === "WAITING_FOR_CLIENT").length], ["Resolved", tickets.filter((ticket) => ticket.status === "RESOLVED").length]]} records={tickets.map((ticket) => ({ id: ticket.id, title: ticket.title, subtitle: ticket.category, status: ticket.status, value: ticket.priority }))} emptyTitle="No support tickets yet" /></AppShell>; }
