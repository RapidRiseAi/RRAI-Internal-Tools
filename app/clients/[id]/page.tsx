import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { AppShell } from "@/components/app-shell";
import {
  ActivityWorkflowForm,
  ClientForm,
  FileRecordForm,
  NoteForm,
  ProjectForm,
  TaskForm,
  QuoteForm,
  SupportTicketForm,
} from "@/components/forms";
import { FileResourceLink } from "@/components/file-resource-link";
import { ModalPanel } from "@/components/modal-panel";
import { RecordResourceLink } from "@/components/record-resource-link";
import { Card, PageHeader, SectionTitle, StatTile, StatusBadge } from "@/components/ui";
import {
  genericList,
  getClient,
  listChecklistTemplates,
  listClients,
  listFiles,
  listLeads,
  listNotes,
  listServices,
  listTasks,
  listUsers,
  recentActivity,
} from "@/lib/data";
import { dateShort, money } from "@/lib/format";
import type {
  ChecklistTemplate,
  Invoice,
  Project,
  Quote,
  Retainer,
  SupportTicket,
} from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
type ProjectFormWithChecklistProps = ComponentProps<typeof ProjectForm> & { checklistTemplates?: ChecklistTemplate[] };
const ProjectFormWithChecklist = ProjectForm as (props: ProjectFormWithChecklistProps) => ReturnType<typeof ProjectForm>;
export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(permissions.clientsRead);
  const { id } = await params;
  const [
    client,
    projects,
    quotes,
    invoices,
    retainers,
    tickets,
    activity,
    notes,
    files,
    clients,
    leads,
    services,
    users,
    tasks,
    checklistTemplates,
  ] = await Promise.all([
    getClient(id),
    genericList<Project>("projects"),
    genericList<Quote>("quotes"),
    genericList<Invoice>("invoices"),
    genericList<Retainer>("retainers"),
    genericList<SupportTicket>("support_tickets"),
    recentActivity(30),
    listNotes({ clientId: id }),
    listFiles({ clientId: id }),
    listClients(),
    listLeads(),
    listServices(),
    listUsers(),
    listTasks(),
    listChecklistTemplates(),
  ]);
  if (!client) notFound();
  const redirectTo = `/clients/${client.id}`;
  const clientProjects = projects.filter(
    (project) => project.client_id === client.id,
  );
  const clientQuotes = quotes.filter((quote) => quote.client_id === client.id);
  const clientInvoices = invoices.filter(
    (invoice) => invoice.client_id === client.id,
  );
  const clientTickets = tickets.filter(
    (ticket) => ticket.client_id === client.id,
  );
  return (
    <AppShell>
      <PageHeader
        title={client.company_name}
        eyebrow="Client detail"
        description="Fast account overview with action pop-ups for edits, quotes, projects, tickets, notes and files."
        actions={
          <>
            <ModalPanel
              title="Edit client"
              triggerLabel="Edit client"
              variant="ghost"
            >
              <ClientForm client={client} />
            </ModalPanel>
            <ModalPanel title="Create quote" triggerLabel="Add quote">
              <QuoteForm
                clients={clients.filter((item) => item.id === client.id)}
                leads={leads}
                services={services}
              />
            </ModalPanel>
            <ModalPanel
              title="Create support ticket"
              triggerLabel="Add ticket"
              variant="ghost"
            >
              <SupportTicketForm
                clients={clients.filter((item) => item.id === client.id)}
                projects={clientProjects}
                users={users}
              />
            </ModalPanel>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-6 content-start">
          <Card>
            <SectionTitle actions={<StatusBadge value={client.account_status} />}>Account health</SectionTitle>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatTile label="MRR" value={money(client.mrr_cents)} />
              <StatTile label="Projects" value={clientProjects.length} />
              <StatTile label="Tickets" value={clientTickets.length} />
              <StatTile label="Retainers" value={retainers.filter((retainer) => retainer.client_id === client.id).length} />
              <StatTile label="Invoices" value={clientInvoices.length} />
              <div className="col-span-2">
                <StatTile label="Next action" value={client.next_action ?? "—"} />
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Quick actions</h2>
            <ModalPanel
              title="Activity workflow"
              triggerLabel="Log activity"
              variant="ghost"
            >
              <ActivityWorkflowForm
                entityType="Client"
                clientId={client.id}
                users={users}
                tasks={tasks.filter(
                  (task) =>
                    task.client_id === client.id && task.status !== "DONE",
                )}
                redirectTo={redirectTo}
                defaultTitle={`Follow up with ${client.company_name}`}
              />
            </ModalPanel>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Recent invoices</h2>
            <div className="mt-4 grid gap-2">
              {clientInvoices.slice(0, 5).map((invoice) => (
                <RecordResourceLink
                  key={invoice.id}
                  title={invoice.invoice_number}
                  meta={<span>{money(invoice.amount_cents)} · {invoice.status}</span>}
                  href={`/billing/${invoice.id}/pdf`}
                  actionLabel="Open PDF"
                />
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Projects</h2>
              <ModalPanel title="Create project" triggerLabel="Add project" variant="ghost">
                <ProjectFormWithChecklist clients={clients.filter((item) => item.id === client.id)} quotes={clientQuotes} users={users} checklistTemplates={checklistTemplates} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {clientProjects.slice(0, 6).map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-xl bg-white/[0.04] p-3 text-sm text-slate-200"
                >
                  <span className="font-semibold text-white">
                    {project.name}
                  </span>
                  <span className="ml-2 text-slate-400">
                    {project.progress}%
                  </span>
                </a>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <ModalPanel title="Add client task" triggerLabel="Add task" variant="ghost">
                <TaskForm users={users.map((user) => ({ id: user.id, name: user.name }))} clients={clients.filter((item) => item.id === client.id)} projects={clientProjects.map((project) => ({ id: project.id, name: project.name, client_id: project.client_id }))} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {tasks.filter((task) => task.client_id === client.id && task.status !== "DONE").slice(0, 6).map((task) => (
                <a key={task.id} href={`/tasks/${task.id}`} className="rounded-xl bg-white/[0.04] p-3 text-sm text-slate-200">
                  <span className="font-semibold text-white">{task.title}</span>
                  <span className="ml-2 text-slate-400">{task.status}</span>
                </a>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Notes</h2>
              <ModalPanel title="Add client note" triggerLabel="Add note" variant="ghost">
                <NoteForm entityType="Client" entityId={client.id} clientId={client.id} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {notes.slice(0, 5).map((note) => (
                <RecordResourceLink
                  key={note.id}
                  title={note.body.slice(0, 80) || "Note"}
                  eyebrow="Note"
                  meta={dateShort(note.created_at)}
                >
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.body}</p>
                </RecordResourceLink>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Files</h2>
              <ModalPanel title="Upload client file" triggerLabel="Upload file" variant="ghost">
                <FileRecordForm entityType="Client" entityId={client.id} clientId={client.id} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {files.map((file) => (
                <FileResourceLink key={file.id} file={file} />
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Timeline</h2>
            <div className="mt-4 grid gap-3">
              {activity
                .filter((item) => item.client_id === client.id)
                .map((item) => (
                  <RecordResourceLink
                    key={item.id}
                    title={item.message}
                    eyebrow={item.action}
                    meta={dateShort(item.created_at)}
                  >
                    <div className="grid gap-3 text-sm text-slate-300">
                      <StatusBadge value={item.action} />
                      <p className="whitespace-pre-wrap">{item.message}</p>
                      <p className="text-xs text-slate-500">{dateShort(item.created_at)}</p>
                    </div>
                  </RecordResourceLink>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
