import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TaskForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { RecordCockpit, type CockpitRecord } from "@/components/record-cockpit";
import { syncMyGoogleCalendar, updateTaskStatus } from "@/lib/actions";
import { Button, Card, EmptyState, InfoRow, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients, listTasks, listUsers } from "@/lib/data";
import { dateShort } from "@/lib/format";
import type { Project } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";

const inspectorAction =
  "rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold transition hover:border-rapid-cyan/40 hover:bg-white/5";

export default async function TasksPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission(permissions.tasksRead);
  const params = (await searchParams) ?? {};
  const googleSync = typeof params.googleSync === "string" ? params.googleSync : null;
  const googleSyncMessage = typeof params.message === "string" ? params.message : null;
  const syncCounts = {
    attempted: typeof params.attempted === "string" ? params.attempted : "0",
    synced: typeof params.synced === "string" ? params.synced : "0",
    skipped: typeof params.skipped === "string" ? params.skipped : "0",
    failed: typeof params.failed === "string" ? params.failed : "0",
  };
  const [tasks, users, projects, clients] = await Promise.all([
    listTasks(),
    listUsers(),
    genericList<Project>("projects"),
    listClients(),
  ]);
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  const projectOptions = projects.map((project) => ({
    id: project.id,
    name: project.name,
    client_id: project.client_id,
  }));
  const records: CockpitRecord[] = tasks.map((task) => ({
    id: task.id,
    href: `/tasks/${task.id}`,
    title: task.title,
    subtitle: task.assignee?.name ?? "Unassigned",
    search: `${task.title} ${task.status} ${task.priority} ${task.assignee?.name ?? ""}`,
    cells: [
      <StatusBadge key="status" value={task.status} />,
      <StatusBadge key="priority" value={task.priority} />,
      dateShort(task.due_date),
      task.recurrence === "NONE" ? "—" : task.recurrence.toLowerCase(),
    ],
    inspector: (
      <div>
        <h3 className="text-lg font-semibold text-white">{task.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge value={task.status} />
          <StatusBadge value={task.priority} />
        </div>
        <div className="mt-4">
          <InfoRow label="Assignee" value={task.assignee?.name ?? "Unassigned"} />
          <InfoRow label="Due" value={dateShort(task.due_date)} />
          <InfoRow label="Type" value={task.type} />
          <InfoRow
            label="Recurrence"
            value={task.recurrence === "NONE" ? "None" : `${task.recurrence.toLowerCase()}${task.recurrence_next_due_at ? ` · next ${dateShort(task.recurrence_next_due_at)}` : ""}`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={`${inspectorAction} text-rapid-cyan`} href={`/tasks/${task.id}`}>
            Open
          </Link>
          <ModalPanel title={`Edit ${task.title}`} triggerLabel="Edit" variant="ghost">
            <TaskForm
              users={userOptions}
              clients={clients}
              projects={projectOptions}
              redirectTo="/tasks"
              task={task}
            />
          </ModalPanel>
          <ModalPanel title={`End ${task.title}`} triggerLabel="End" variant="ghost">
            <form action={updateTaskStatus} className="grid gap-3">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="redirectTo" value="/tasks" />
              <label className="grid gap-2 text-sm text-slate-300">
                End task as
                <select className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-2 text-sm" name="status" defaultValue="DONE">
                  <option value="DONE">Complete</option>
                  <option value="SCRAPPED">Scrap</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Outcome / what happened
                <textarea className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-2 text-sm" name="outcome" required />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Scrap / blocker reason
                <textarea className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-2 text-sm" name="scrapReason" />
              </label>
              <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-rapid-cyan">
                End task
              </button>
            </form>
          </ModalPanel>
        </div>
      </div>
    ),
  }));
  return (
    <AppShell>
      <PageHeader
        eyebrow="Workload"
        title="Tasks"
        description="A clean workload overview. Add tasks from the button, open task details, edit assignments, or end tasks from each row."
        actions={
          <>
            <LinkButton href="/api/auth/google/start?mode=connect&returnTo=/tasks" variant="ghost">Connect Google</LinkButton>
            <form action={syncMyGoogleCalendar}>
              <input type="hidden" name="returnTo" value="/tasks" />
              <Button type="submit">Sync Google Calendar</Button>
            </form>
            <ModalPanel title="Create task" triggerLabel="Add task">
              <TaskForm
                users={userOptions}
                clients={clients}
                projects={projectOptions}
              />
            </ModalPanel>
          </>
        }
      />
      {googleSync ? (
        <Card className={googleSync === "success" ? "mb-6 border-emerald-400/30 bg-emerald-400/10" : "mb-6 border-red-400/30 bg-red-400/10"}>
          <p className="text-sm font-semibold text-white">
            {googleSync === "success" ? "Google Calendar sync completed." : "Google Calendar sync had errors."}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Attempted {syncCounts.attempted}, synced {syncCounts.synced}, skipped {syncCounts.skipped}, failed {syncCounts.failed}.
            {googleSyncMessage ? ` ${googleSyncMessage}` : ""}
          </p>
        </Card>
      ) : null}
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Open", tasks.filter((task) => !["DONE", "SCRAPPED"].includes(task.status)).length],
            [
              "Overdue",
              tasks.filter(
                (task) =>
                  task.due_date &&
                  new Date(task.due_date) < new Date() &&
                  !["DONE", "SCRAPPED"].includes(task.status),
              ).length,
            ],
            [
              "Blocked",
              tasks.filter((task) => task.status === "BLOCKED").length,
            ],
            ["Done", tasks.filter((task) => task.status === "DONE").length],
            ["Scrapped", tasks.filter((task) => task.status === "SCRAPPED").length],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        {tasks.length ? (
          <RecordCockpit
            columns={["Task", "Status", "Priority", "Due", "Recurrence"]}
            gridTemplate="minmax(0,1.5fr) auto auto 0.9fr 1fr"
            records={records}
            searchPlaceholder="Filter tasks by title, status or assignee…"
          />
        ) : (
          <EmptyState
            title="No tasks yet"
            body="Use Add task or book events from clients/leads to populate this workload."
          />
        )}
      </div>
    </AppShell>
  );
}
