import { AppShell } from "@/components/app-shell";
import { TaskForm, type ProjectOption, type UserOption } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { syncMyGoogleCalendar, updateTaskStatus } from "@/lib/actions";
import { Button, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DeckCard, DeckStatusBadge } from "@/components/command-deck";
import { genericList, listClients, listTasks, listUsers } from "@/lib/data";
import { dateShort } from "@/lib/format";
import { appTimeZone } from "@/lib/timezone";
import type { Client, Project, Task } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { CalendarClock, Repeat } from "lucide-react";

export const dynamic = "force-dynamic";

const taskTimeZone = appTimeZone();
const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: taskTimeZone });

/** Wall-clock window for a task, e.g. "4:00 PM – 5:00 PM", in the app timezone. */
function timeRange(due: string | null, durationMinutes: number | null) {
  if (!due) return null;
  const start = new Date(due);
  const end = new Date(start.getTime() + Math.max(5, durationMinutes ?? 60) * 60_000);
  return `${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

/** Human cadence label, e.g. "Weekly · Fri" or "Monthly · day 15". */
function cadenceLabel(task: Task) {
  const interval = task.recurrence_interval && task.recurrence_interval > 1 ? task.recurrence_interval : null;
  if (task.recurrence === "WEEKLY") {
    const day = typeof task.recurrence_day_of_week === "number" ? weekdayShort[task.recurrence_day_of_week] : null;
    return `Weekly${interval ? ` · every ${interval} wks` : ""}${day ? ` · ${day}` : ""}`;
  }
  if (task.recurrence === "MONTHLY") {
    return `Monthly${interval ? ` · every ${interval} mo` : ""}${task.recurrence_day_of_month ? ` · day ${task.recurrence_day_of_month}` : ""}`;
  }
  return "—";
}

/** Step a date forward by one recurrence interval (mirrors the calendar projection). */
function stepRecurrence(date: Date, task: Task) {
  const next = new Date(date);
  const interval = Math.max(task.recurrence_interval || 1, 1);
  if (task.recurrence === "WEEKLY") {
    next.setDate(next.getDate() + interval * 7);
    return next;
  }
  const dayOfMonth = task.recurrence_day_of_month ?? next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + interval);
  next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  return next;
}

/** Next upcoming occurrence from today for an always-there series (null if none / completion-gated). */
function nextOccurrence(task: Task): Date | null {
  if (!task.due_date || task.recurrence === "NONE") return null;
  const now = new Date();
  let cursor = new Date(task.due_date);
  let guard = 0;
  while (cursor < now && guard < 600) {
    cursor = stepRecurrence(cursor, task);
    guard += 1;
  }
  return cursor;
}

/** Shared row actions: open detail, edit (single source of truth), end. */
function RowActions({ task, users, clients, projects }: { task: Task; users: UserOption[]; clients: Client[]; projects: ProjectOption[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <LinkButton href={`/tasks/${task.id}`} variant="ghost">Open</LinkButton>
      <ModalPanel title={`Edit ${task.title}`} triggerLabel="Edit" variant="ghost">
        <TaskForm users={users} clients={clients} projects={projects} redirectTo="/tasks" task={task} />
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
          <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-rapid-cyan">End task</button>
        </form>
      </ModalPanel>
    </div>
  );
}

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
  const userOptions: UserOption[] = users.map((user) => ({ id: user.id, name: user.name }));
  const projectOptions: ProjectOption[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    client_id: project.client_id ?? undefined,
  }));

  // Always-there recurring tasks no longer generate per-occurrence rows. Hide any stale
  // automatic child rows so the list stays one-row-per-series; completion-required
  // children are real to-dos and remain visible.
  const visibleTasks = tasks.filter((task) => !(task.recurrence_parent_task_id && !task.recurrence_completion_required));
  const recurringSeries = visibleTasks.filter((task) => task.recurrence !== "NONE" && !task.recurrence_parent_task_id);
  const recurringIds = new Set(recurringSeries.map((task) => task.id));
  const regularTasks = visibleTasks.filter((task) => !recurringIds.has(task.id));

  const isEnded = (task: Task) => ["DONE", "SCRAPPED"].includes(task.status);
  const stats: [string, number][] = [
    ["Open", visibleTasks.filter((task) => !isEnded(task)).length],
    ["Overdue", visibleTasks.filter((task) => task.due_date && new Date(task.due_date) < new Date() && !isEnded(task)).length],
    ["Recurring", recurringSeries.filter((task) => !isEnded(task)).length],
    ["Done", visibleTasks.filter((task) => task.status === "DONE").length],
    ["Scrapped", visibleTasks.filter((task) => task.status === "SCRAPPED").length],
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workload"
        title="Tasks"
        description="Recurring meetings live in their own section — edit one and every occurrence follows. One-off work sits below."
        actions={
          <>
            <LinkButton href="/api/auth/google/start?mode=connect&returnTo=/tasks" variant="ghost">Connect Google</LinkButton>
            <form action={syncMyGoogleCalendar}>
              <input type="hidden" name="returnTo" value="/tasks" />
              <Button type="submit">Sync Google Calendar</Button>
            </form>
            <ModalPanel title="Create task" triggerLabel="Add task">
              <TaskForm users={userOptions} clients={clients} projects={projectOptions} />
            </ModalPanel>
          </>
        }
      />

      {googleSync ? (
        <DeckCard
          glow={false}
          padding="p-4"
          className={`mb-6 ${googleSync === "success" ? "border-pos/30 bg-pos/[0.06]" : "border-neg/30 bg-neg/[0.06]"}`}
        >
          <p className="text-sm font-semibold text-deck-text">
            {googleSync === "success" ? "Google Calendar sync completed." : "Google Calendar sync had errors."}
          </p>
          <p className="mt-1 text-sm text-deck-muted">
            Attempted {syncCounts.attempted}, synced {syncCounts.synced}, skipped {syncCounts.skipped}, failed {syncCounts.failed}.
            {googleSyncMessage ? ` ${googleSyncMessage}` : ""}
          </p>
        </DeckCard>
      ) : null}

      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {stats.map(([label, value]) => (
            <DeckCard key={label} padding="p-4">
              <p className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-deck-muted">{label}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-deck-text">{value}</p>
            </DeckCard>
          ))}
        </div>

        {/* Recurring series — one editable row per series. */}
        <DeckCard padding="p-0" glow={false} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3">
            <Repeat className="size-4 text-accent-cyan" />
            <h2 className="font-display text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-deck-text">Recurring</h2>
            <span className="font-mono text-xs text-deck-muted">{recurringSeries.length}</span>
          </div>
          {recurringSeries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[0.62rem] uppercase tracking-wider text-deck-muted">
                  <tr className="border-b border-hairline/60">
                    <th className="px-5 py-2.5 font-semibold">Task</th>
                    <th className="py-2.5 font-semibold">Cadence</th>
                    <th className="py-2.5 font-semibold">Next</th>
                    <th className="py-2.5 font-semibold">Time</th>
                    <th className="py-2.5 font-semibold">Mode</th>
                    <th className="py-2.5 font-semibold">Assignee</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringSeries.map((task) => {
                    const auto = !task.recurrence_completion_required;
                    const next = auto ? nextOccurrence(task) : null;
                    return (
                      <tr key={task.id} id={task.id} className="border-b border-hairline/50 last:border-0">
                        <td className="px-5 py-3 font-semibold">
                          <a href={`/tasks/${task.id}`} className="text-deck-text transition hover:text-accent-cyan">{task.title}</a>
                        </td>
                        <td className="py-3 text-deck-muted">{cadenceLabel(task)}</td>
                        <td className="py-3 font-mono text-xs text-deck-text">
                          {auto ? (next ? dateShort(next.toISOString()) : "—") : <span className="text-deck-muted">after completion</span>}
                        </td>
                        <td className="py-3 font-mono text-xs text-deck-muted">{timeRange(task.due_date, task.duration_minutes) ?? "—"}</td>
                        <td className="py-3">
                          <DeckStatusBadge value={auto ? "Always on" : "Mark complete"} tone={auto ? "cyan" : "copper"} />
                        </td>
                        <td className="py-3 text-deck-muted">{task.assignee?.name ?? "Unassigned"}</td>
                        <td className="px-5 py-2">
                          <RowActions task={task} users={userOptions} clients={clients} projects={projectOptions} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-deck-muted">
              No recurring tasks yet. Add a task and choose a weekly or monthly cadence to schedule a standing meeting.
            </div>
          )}
        </DeckCard>

        {/* One-off / non-recurring work. */}
        <DeckCard padding="p-0" glow={false} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3">
            <CalendarClock className="size-4 text-accent-cyan" />
            <h2 className="font-display text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-deck-text">Tasks</h2>
            <span className="font-mono text-xs text-deck-muted">{regularTasks.length}</span>
          </div>
          {regularTasks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[0.62rem] uppercase tracking-wider text-deck-muted">
                  <tr className="border-b border-hairline/60">
                    <th className="px-5 py-2.5 font-semibold">Task</th>
                    <th className="py-2.5 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold">Priority</th>
                    <th className="py-2.5 font-semibold">Assignee</th>
                    <th className="py-2.5 font-semibold">Due</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularTasks.map((task) => (
                    <tr key={task.id} id={task.id} className="border-b border-hairline/50 last:border-0">
                      <td className="px-5 py-3 font-semibold">
                        <a href={`/tasks/${task.id}`} className="text-deck-text transition hover:text-accent-cyan">{task.title}</a>
                      </td>
                      <td className="py-3"><DeckStatusBadge value={task.status} /></td>
                      <td className="py-3"><DeckStatusBadge value={task.priority} /></td>
                      <td className="py-3 text-deck-muted">{task.assignee?.name ?? "Unassigned"}</td>
                      <td className="py-3 font-mono text-xs text-deck-muted">{dateShort(task.due_date)}</td>
                      <td className="px-5 py-2">
                        <RowActions task={task} users={userOptions} clients={clients} projects={projectOptions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No tasks yet" body="Use Add task or book events from clients/leads to populate this workload." />
          )}
        </DeckCard>
      </div>
    </AppShell>
  );
}
