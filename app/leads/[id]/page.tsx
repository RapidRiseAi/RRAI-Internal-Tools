import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FileResourceLink } from "@/components/file-resource-link";
import { ActivityWorkflowForm, FileRecordForm, LeadForm, NoteForm, QuoteForm, TaskForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { RecordResourceLink } from "@/components/record-resource-link";
import { SubmitButton } from "@/components/submit-button";
import { Card, InfoRow, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { archiveLead, convertLeadToClient } from "@/lib/actions";
import {
  getLead,
  listClients,
  listFiles,
  listLeads,
  listNotes,
  listServices,
  listTasks,
  listUsers,
  recentActivity,
} from "@/lib/data";
import { dateShort } from "@/lib/format";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(permissions.leadsRead);
  const { id } = await params;
  const [lead, users, activity, notes, files, clients, leads, services, tasks] =
    await Promise.all([
      getLead(id),
      listUsers(),
      recentActivity(20),
      listNotes({ leadId: id }),
      listFiles({ leadId: id }),
      listClients(),
      listLeads(),
      listServices(),
      listTasks(),
    ]);
  if (!lead) notFound();
  const redirectTo = `/leads/${lead.id}`;
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  return (
    <AppShell>
      <PageHeader
        title={lead.company_name}
        eyebrow="Lead detail"
        description={`${lead.contact_name} • ${lead.service_interest}`}
        actions={
          <>
            <ModalPanel
              title="Edit lead"
              triggerLabel="Edit lead"
              variant="ghost"
            >
              <LeadForm lead={lead} users={userOptions} />
            </ModalPanel>
            <ModalPanel title="Create quote" triggerLabel="Add quote">
              <QuoteForm
                clients={clients}
                leads={leads.filter((item) => item.id === lead.id)}
                services={services}
              />
            </ModalPanel>
            <form action={convertLeadToClient}>
              <input
                type="hidden"
                name="submissionKey"
                value={`lead-convert:${lead.id}:${randomUUID()}`}
              />
              <input type="hidden" name="leadId" value={lead.id} />
              <SubmitButton pendingLabel="Converting…">Convert</SubmitButton>
            </form>
            <form action={archiveLead}>
              <input
                type="hidden"
                name="submissionKey"
                value={`lead-archive:${lead.id}:${randomUUID()}`}
              />
              <input type="hidden" name="id" value={lead.id} />
              <SubmitButton
                pendingLabel="Archiving…"
                className="border border-red-400/30 bg-none bg-red-400/10 text-red-100 shadow-none hover:bg-red-400/20"
              >
                Archive
              </SubmitButton>
            </form>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-6 content-start">
          <Card>
            <SectionTitle>Overview</SectionTitle>
            <div className="mt-4">
              <div className="mb-3"><StatusBadge value={lead.stage} /></div>
              <InfoRow label="Score" value={`${lead.score}/100`} />
              <InfoRow label="Follow-up" value={dateShort(lead.follow_up_date)} />
              <InfoRow label="Owner" value={lead.assignee?.name ?? "Unassigned"} />
              <InfoRow label="Next action" value={lead.next_action ?? "—"} />
              <InfoRow label="Pain points" value={lead.pain_points ?? "—"} />
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
                entityType="Lead"
                leadId={lead.id}
                users={userOptions}
                tasks={tasks.filter((task) => task.status !== "DONE")}
                redirectTo={redirectTo}
                defaultTitle={`Follow up with ${lead.company_name}`}
              />
            </ModalPanel>
          </Card>
        </div>
        <div className="grid gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <ModalPanel title="Add lead task" triggerLabel="Add task" variant="ghost">
                <TaskForm users={userOptions} clients={clients} projects={[]} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {tasks.filter((task) => task.status !== "DONE").slice(0, 6).map((task) => (
                <a key={task.id} href={`/tasks/${task.id}`} className="rounded-xl bg-white/[0.04] p-3 text-sm text-slate-200">
                  <span className="font-semibold text-white">{task.title}</span>
                  <span className="ml-2 text-slate-400">{task.status}</span>
                </a>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent notes</h2>
              <ModalPanel title="Add lead note" triggerLabel="Add note" variant="ghost">
                <NoteForm entityType="Lead" entityId={lead.id} leadId={lead.id} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {notes.slice(0, 5).map((note) => (
                <RecordResourceLink key={note.id} title={note.body.slice(0, 80) || "Note"} eyebrow="Note" meta={dateShort(note.created_at)}>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.body}</p>
                </RecordResourceLink>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Files</h2>
              <ModalPanel title="Upload lead file" triggerLabel="Upload file" variant="ghost">
                <FileRecordForm entityType="Lead" entityId={lead.id} leadId={lead.id} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {files.map((file) => (
                <FileResourceLink key={file.id} file={file} className="border border-white/10 hover:border-rapid-cyan/40" />
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Activity history</h2>
            <div className="mt-4 grid gap-3">
              {activity
                .filter((item) => item.lead_id === lead.id)
                .map((item) => (
                  <RecordResourceLink key={item.id} title={item.message} eyebrow={item.action} meta={dateShort(item.created_at)}>
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
