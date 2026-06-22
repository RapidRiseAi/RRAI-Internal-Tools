import { Clock, Play, Square, Timer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { BarList, DeckCard, ListPanel, ListRow, PanelHeader, type Tone } from "@/components/command-deck";
import { ModalPanel } from "@/components/modal-panel";
import { inputClass } from "@/components/ui";
import { clockInAction, clockOutAction, deleteTimeEntryAction, logTimeAction } from "@/lib/actions";
import { listTasks, listTimeEntries, listUsers } from "@/lib/data";
import { dateTimeShort, money } from "@/lib/format";
import { startOfWeekMonday } from "@/lib/deck-metrics";
import type { TimeEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function hoursLabel(minutes: number) {
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export default async function TimePage() {
  const user = await requirePagePermission(permissions.dashboard);
  const [entries, tasks, users] = await Promise.all([listTimeEntries(300), listTasks(), listUsers()]);

  const now = Date.now();
  const durMin = (entry: TimeEntry) => ((entry.ended_at ? new Date(entry.ended_at).getTime() : now) - new Date(entry.started_at).getTime()) / 60000;

  const running = entries.filter((entry) => !entry.ended_at);
  const myRunning = running.find((entry) => entry.user_id === user.id) ?? null;

  const weekStart = startOfWeekMonday(new Date());
  const weekEntries = entries.filter((entry) => new Date(entry.started_at) >= weekStart);
  const weekMinutes = weekEntries.reduce((sum, entry) => sum + durMin(entry), 0);
  const billableMinutes = weekEntries.filter((entry) => entry.is_billable).reduce((sum, entry) => sum + durMin(entry), 0);

  const userById = new Map(users.map((candidate) => [candidate.id, candidate]));
  const laborCostCents = weekEntries.reduce((sum, entry) => {
    const candidate = userById.get(entry.user_id);
    return sum + Math.round((durMin(entry) / 60) * (candidate?.pay_rate_cents ?? 0));
  }, 0);

  const byEmployee = users
    .map((candidate) => ({ name: candidate.name, minutes: weekEntries.filter((entry) => entry.user_id === candidate.id).reduce((sum, entry) => sum + durMin(entry), 0) }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((row) => ({ label: row.name, value: Math.round((row.minutes / 60) * 10) / 10, sub: hoursLabel(row.minutes) }));

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const actualByTask = new Map<string, number>();
  for (const entry of weekEntries) {
    if (entry.task_id) actualByTask.set(entry.task_id, (actualByTask.get(entry.task_id) ?? 0) + durMin(entry));
  }
  const taskRows = [...actualByTask.entries()]
    .map(([taskId, minutes]) => ({ id: taskId, title: taskById.get(taskId)?.title ?? "Task", actualMin: minutes, estMin: taskById.get(taskId)?.duration_minutes ?? 0 }))
    .sort((a, b) => b.actualMin - a.actualMin)
    .slice(0, 8);

  const myOpenTasks = tasks.filter((task) => task.assigned_to === user.id && !["DONE", "SCRAPPED"].includes(task.status));
  const recent = entries.slice(0, 14);

  const stats: [string, string][] = [
    ["Hours this week", hoursLabel(weekMinutes)],
    ["Billable", `${weekMinutes ? Math.round((billableMinutes / weekMinutes) * 100) : 0}%`],
    ["Tracking now", String(running.length)],
    ["Est. labour cost", money(laborCostCents)],
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-accent-cyan">Operations</p>
            <h1 className="font-display text-xl font-bold tracking-tight text-deck-text">Time Tracking</h1>
          </div>
          <ModalPanel title="Log time manually" triggerLabel="Log time" variant="ghost">
            <form action={logTimeAction} className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-deck-muted md:col-span-2">Task (optional)
                <select name="taskId" className={inputClass} defaultValue="">
                  <option value="" className="bg-deck-panel">No task</option>
                  {myOpenTasks.map((task) => <option key={task.id} value={task.id} className="bg-deck-panel">{task.title}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-deck-muted">Start
                <input name="startedAt" type="datetime-local" required className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-deck-muted">End
                <input name="endedAt" type="datetime-local" className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-deck-muted md:col-span-2">Description
                <input name="description" className={inputClass} placeholder="What did you work on?" />
              </label>
              <label className="flex items-center gap-2 text-sm text-deck-muted md:col-span-2"><input name="isBillable" type="checkbox" defaultChecked /> Billable</label>
              <input type="hidden" name="redirectTo" value="/time" />
              <button type="submit" className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-deck-bg transition hover:brightness-110 md:col-span-2">Save entry</button>
            </form>
          </ModalPanel>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map(([label, value]) => (
            <DeckCard key={label} padding="p-3">
              <p className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-deck-muted">{label}</p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-deck-text">{value}</p>
            </DeckCard>
          ))}
        </div>

        {/* Clock in / running */}
        <DeckCard padding="p-4">
          {myRunning ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-pos/30 bg-pos/10 text-pos"><Timer className="size-5" /></span>
                <div>
                  <p className="text-sm font-semibold text-deck-text">{myRunning.task?.title ?? myRunning.description ?? "Tracking time"}</p>
                  <p className="font-mono text-xs text-deck-muted">Started {dateTimeShort(myRunning.started_at)}</p>
                </div>
              </div>
              <form action={clockOutAction}>
                <input type="hidden" name="redirectTo" value="/time" />
                <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-deck-bg transition hover:brightness-110"><Square className="size-3.5 fill-current" /> Clock out</button>
              </form>
            </div>
          ) : (
            <form action={clockInAction} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 text-sm font-medium text-deck-muted">Task
                <select name="taskId" className={inputClass} defaultValue="">
                  <option value="" className="bg-deck-panel">No task</option>
                  {myOpenTasks.map((task) => <option key={task.id} value={task.id} className="bg-deck-panel">{task.title}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-deck-muted">What are you working on?
                <input name="description" className={inputClass} placeholder="Optional description" />
              </label>
              <input type="hidden" name="redirectTo" value="/time" />
              <input type="hidden" name="isBillable" value="on" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-deck-bg transition hover:brightness-110"><Play className="size-4 fill-current" /> Clock in</button>
            </form>
          )}
        </DeckCard>

        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
          <DeckCard padding="p-4" className="flex flex-col">
            <PanelHeader title="Hours by Employee" right={<span className="font-mono text-xs text-deck-muted">this week</span>} />
            <div className="mt-3"><BarList items={byEmployee} tone="cyan" /></div>
          </DeckCard>

          <ListPanel title="Estimate vs Actual" right={<span className="font-mono text-xs text-deck-muted">this week</span>}>
            {taskRows.length ? taskRows.map((row) => {
              const over = row.estMin > 0 && row.actualMin > row.estMin;
              const tone: Tone = over ? "neg" : row.estMin > 0 ? "pos" : "neutral";
              return (
                <ListRow
                  key={row.id}
                  icon={Clock}
                  iconTone={tone}
                  title={row.title}
                  subtitle={row.estMin > 0 ? `Est ${hoursLabel(row.estMin)} · actual ${hoursLabel(row.actualMin)}` : `Actual ${hoursLabel(row.actualMin)} · no estimate`}
                  trailing={<span className={`font-mono text-xs font-semibold ${over ? "text-neg" : "text-pos"}`}>{hoursLabel(row.actualMin)}</span>}
                  href={`/tasks/${row.id}`}
                />
              );
            }) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No task time logged this week.</div>}
          </ListPanel>

          <ListPanel title="Tracking Now" right={<span className="font-mono text-xs text-deck-muted">{running.length}</span>}>
            {running.length ? running.map((entry) => (
              <ListRow
                key={entry.id}
                icon={Timer}
                iconTone="pos"
                title={entry.user?.name ?? "Someone"}
                subtitle={entry.task?.title ?? entry.description ?? "Tracking time"}
                trailing={<span className="font-mono text-xs text-pos">{hoursLabel(durMin(entry))}</span>}
              />
            )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">Nobody is clocked in right now.</div>}
          </ListPanel>

          <ListPanel title="Recent Entries" right={<span className="font-mono text-xs text-deck-muted">{recent.length}</span>}>
            {recent.length ? recent.map((entry) => (
              <ListRow
                key={entry.id}
                icon={Clock}
                iconTone={entry.is_billable ? "cyan" : "neutral"}
                title={entry.task?.title ?? entry.description ?? "Time entry"}
                subtitle={`${entry.user?.name ?? ""} · ${dateTimeShort(entry.started_at)}`}
                trailing={
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-deck-muted">{entry.ended_at ? hoursLabel(durMin(entry)) : "running"}</span>
                    {entry.user_id === user.id ? (
                      <form action={deleteTimeEntryAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="redirectTo" value="/time" />
                        <button className="grid size-6 place-items-center rounded text-deck-muted transition hover:text-neg" aria-label="Delete entry"><Trash2 className="size-3.5" /></button>
                      </form>
                    ) : null}
                  </div>
                }
              />
            )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No time entries yet.</div>}
          </ListPanel>
        </div>
      </div>
    </AppShell>
  );
}
