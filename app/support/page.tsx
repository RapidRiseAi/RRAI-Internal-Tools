import { AppShell } from "@/components/app-shell";
import { SupportTicketForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients, listUsers } from "@/lib/data";
import type { Project, SupportTicket } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function Support() {
  await requirePagePermission(permissions.supportRead);
  const [tickets, clients, projects, users] = await Promise.all([
    genericList<SupportTicket>("support_tickets"),
    listClients(),
    genericList<Project>("projects"),
    listUsers(),
  ]);
  const stats = [
    ["Tickets", tickets.length],
    [
      "Open",
      tickets.filter(
        (ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status),
      ).length,
    ],
    ["Urgent", tickets.filter((ticket) => ticket.priority === "URGENT").length],
    [
      "Waiting client",
      tickets.filter((ticket) => ticket.status === "WAITING_FOR_CLIENT").length,
    ],
    [
      "Resolved",
      tickets.filter((ticket) => ticket.status === "RESOLVED").length,
    ],
  ];
  return (
    <AppShell>
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description="A clean support overview for ticket volume, priority and next actions. Create or update tickets from pop-up actions only."
        actions={
          <ModalPanel title="Create support ticket" triggerLabel="Add ticket">
            <SupportTicketForm
              clients={clients}
              projects={projects}
              users={users}
            />
          </ModalPanel>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {stats.map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Active support queue
            </h2>
            <span className="text-xs text-slate-500">
              Click edit to update details
            </span>
          </div>
          {tickets.length ? (
            <div className="grid gap-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{ticket.title}</p>
                      <StatusBadge value={ticket.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {ticket.category} • {ticket.priority} •{" "}
                      {ticket.resolution_notes ??
                        ticket.internal_notes ??
                        "No notes"}
                    </p>
                  </div>
                  <ModalPanel
                    title="Update ticket"
                    triggerLabel="Edit"
                    variant="ghost"
                  >
                    <SupportTicketForm
                      clients={clients}
                      projects={projects}
                      users={users}
                      ticket={ticket}
                    />
                  </ModalPanel>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No support tickets"
              body="Use Add ticket when a client needs help, then keep this page focused on queue health."
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
