import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  FileRecordForm,
  NoteForm,
  ProjectForm,
  TaskForm,
} from "@/components/forms";
import { FileResourceLink } from "@/components/file-resource-link";
import { ModalPanel } from "@/components/modal-panel";
import { RecordResourceLink } from "@/components/record-resource-link";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageHeader, StatusBadge, inputClass } from "@/components/ui";
import { updateProjectChecklist } from "@/lib/actions";
import {
  genericList,
  getProject,
  getProjectChecklist,
  listClients,
  listFiles,
  listNotes,
  listUsers,
} from "@/lib/data";
import { dateShort } from "@/lib/format";
import type { Quote, Task } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(permissions.projectsRead);
  const { id } = await params;
  const [project, clients, quotes, users, tasks, checklist, notes, files] =
    await Promise.all([
      getProject(id),
      listClients(),
      genericList<Quote>("quotes"),
      listUsers(),
      genericList<Task>("tasks"),
      getProjectChecklist(id),
      listNotes({ projectId: id }),
      listFiles({ projectId: id }),
    ]);
  if (!project) notFound();
  const redirectTo = `/projects/${project.id}`;
  return (
    <AppShell>
      <PageHeader
        eyebrow="Project detail"
        title={project.name}
        description="Delivery plan, checklist, tasks, notes and file uploads."
        actions={
          <>
            <ModalPanel
              title="Edit project"
              triggerLabel="Edit project"
              variant="ghost"
            >
              <ProjectForm
                project={project}
                clients={clients}
                quotes={quotes}
                users={users}
              />
            </ModalPanel>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="grid gap-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Project checklist</h2>
            <div className="grid gap-3">
              {checklist.map((item) => (
                <form
                  key={item.id}
                  action={updateProjectChecklist}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3"
                >
                  <input
                    type="hidden"
                    name="submissionKey"
                    value={`project-checklist:${item.id}:${randomUUID()}`}
                  />
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      Updated {dateShort(item.updated_at)}
                    </p>
                  </div>
                  <select
                    className={inputClass}
                    name="status"
                    defaultValue={item.status}
                  >
                    <option value="TO_DO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_FOR_CLIENT">
                      Waiting for Client
                    </option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="DONE">Done</option>
                  </select>
                  <SubmitButton
                    pendingLabel="Saving…"
                    className="border border-white/10 bg-none bg-white/5 shadow-none"
                  >
                    Save
                  </SubmitButton>
                </form>
              ))}
              {!checklist.length ? (
                <p className="text-sm text-slate-400">
                  No checklist items yet. Create projects with starter
                  checklists or add templates in settings.
                </p>
              ) : null}
            </div>
          </Card>
        </div>
        <div className="grid gap-6">
          <Card>
            <h2 className="text-lg font-semibold">Status</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <StatusBadge value={project.status} />
              <p>Progress: {project.progress}%</p>
              <p>Deadline: {dateShort(project.deadline)}</p>
              <p>Blocker: {project.blocker ?? "None"}</p>
              <p>
                Open tasks:{" "}
                {
                  tasks.filter(
                    (task) =>
                      task.project_id === project.id && task.status !== "DONE",
                  ).length
                }
              </p>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <ModalPanel title="Create linked task" triggerLabel="Add task" variant="ghost">
                <TaskForm users={users} clients={clients} projects={[{ id: project.id, name: project.name }]} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {tasks.filter((task) => task.project_id === project.id).slice(0, 6).map((task) => (
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
              <ModalPanel title="Add project note" triggerLabel="Add note" variant="ghost">
                <NoteForm entityType="Project" entityId={project.id} clientId={project.client_id} projectId={project.id} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {notes.map((note) => (
                <RecordResourceLink key={note.id} title={note.body.slice(0, 80) || "Note"} eyebrow="Note" meta={dateShort(note.created_at)}>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.body}</p>
                </RecordResourceLink>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Files</h2>
              <ModalPanel title="Upload project file" triggerLabel="Upload file" variant="ghost">
                <FileRecordForm entityType="Project" entityId={project.id} clientId={project.client_id} projectId={project.id} redirectTo={redirectTo} />
              </ModalPanel>
            </div>
            <div className="mt-4 grid gap-2">
              {files.map((file) => (
                <FileResourceLink key={file.id} file={file} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
