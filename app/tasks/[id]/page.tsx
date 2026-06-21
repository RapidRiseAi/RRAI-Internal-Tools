import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FileRecordForm, TaskForm } from "@/components/forms";
import { FileResourceLink } from "@/components/file-resource-link";
import { ModalPanel } from "@/components/modal-panel";
import { Card, InfoRow, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { updateTaskStatus } from "@/lib/actions";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { genericList, getTask, listClients, listFiles, listUsers } from "@/lib/data";
import { dateShort } from "@/lib/format";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission(permissions.tasksRead);
  const { id } = await params;
  const [task, users, clients, projects, files] = await Promise.all([
    getTask(id),
    listUsers(),
    listClients(),
    genericList<Project>("projects"),
    listFiles({ entityId: id }),
  ]);
  if (!task) notFound();
  const redirectTo = `/tasks/${task.id}`;
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name, client_id: project.client_id }));
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  const taskLinks = files.filter((file) => file.mime_type === "text/uri-list");
  const taskFiles = files.filter((file) => file.mime_type !== "text/uri-list");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Task detail"
        title={task.title}
        description="Review instructions, resources, links, files and close-out logs for this task."
        actions={
          <>
            <ModalPanel title="Update task" triggerLabel="Update task" variant="ghost">
              <TaskForm users={userOptions} clients={clients} projects={projectOptions} redirectTo={redirectTo} task={task} />
            </ModalPanel>
            <ModalPanel title="Complete or scrap task" triggerLabel="Complete task">
              <form action={updateTaskStatus} className="grid gap-4">
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="grid gap-2 text-sm text-slate-300">
                  Close as
                  <select className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2" name="status" defaultValue="DONE">
                    <option value="DONE">Complete</option>
                    <option value="SCRAPPED">Scrap</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-slate-300">
                  Outcome / what happened
                  <textarea className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2" name="outcome" required />
                </label>
                <label className="grid gap-2 text-sm text-slate-300">
                  Scrap / blocker reason
                  <textarea className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2" name="scrapReason" />
                </label>
                <button className="rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 font-semibold text-white">Save outcome</button>
              </form>
            </ModalPanel>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="grid gap-6">
          <Card>
            <SectionTitle actions={<StatusBadge value={task.status} />}>Instructions &amp; outcome</SectionTitle>
            <div className="mt-4">
              <InfoRow label="Type" value={task.type} />
              <InfoRow label="Priority" value={task.priority} />
              <InfoRow label="Due" value={dateShort(task.due_date)} />
              <InfoRow label="Assignee" value={task.assignee?.name ?? "Unassigned"} />
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">{task.description ?? "No instructions recorded yet."}</pre>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Files & links</h2>
              <ModalPanel title="Upload task files or add link" triggerLabel="Upload / add link" variant="ghost">
                <FileRecordForm entityType="Task" entityId={task.id} clientId={task.client_id ?? undefined} projectId={task.project_id ?? undefined} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-white">Files</p>
                {taskFiles.map((file) => <FileResourceLink key={file.id} file={file} />)}
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-white">Links</p>
                {taskLinks.map((file) => <FileResourceLink key={file.id} file={file} />)}
              </div>
            </div>
          </Card>
        </div>
        <Card>
          <SectionTitle>Task metadata</SectionTitle>
          <div className="mt-4">
            <InfoRow label="Client" value={clients.find((client) => client.id === task.client_id)?.company_name ?? "No client"} />
            <InfoRow label="Project" value={projects.find((project) => project.id === task.project_id)?.name ?? "No project"} />
            <InfoRow label="Created" value={dateShort(task.created_at)} />
            <InfoRow label="Updated" value={dateShort(task.updated_at)} />
            <InfoRow label="Completed" value={dateShort(task.completed_at)} />
            <InfoRow label="Recurrence" value={task.recurrence === "NONE" ? "None" : task.recurrence} />
            {task.recurrence !== "NONE" ? <InfoRow label="Next occurrence" value={dateShort(task.recurrence_next_due_at)} /> : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
