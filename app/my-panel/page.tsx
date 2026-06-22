import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  ListTodo,
  Loader,
  StickyNote,
  Target,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import {
  DatePill,
  DeckCard,
  DeckStatusBadge,
  KpiCard,
  ListPanel,
  ListRow,
  PanelHeader,
  ProgressBar,
  WorkloadBars,
  type Tone,
} from "@/components/command-deck";
import { genericList, listClients, listLeads, listSelfNotes, listTasks, notificationsForUser } from "@/lib/data";
import { addSelfNoteAction, deleteSelfNoteAction } from "@/lib/actions";
import { inputClass } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { isInMonthOffset, pct, startOfWeekMonday } from "@/lib/deck-metrics";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

const inProgressStatuses = ["IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_INTERNALLY", "REVIEW_NEEDED"];

function sameDay(dateStr: string | null | undefined, day: Date) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

function hoursLabel(minutes: number) {
  if (!minutes) return "0h";
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function dueTone(dateStr: string | null, startToday: Date): Tone {
  if (!dateStr) return "neutral";
  const time = new Date(dateStr).getTime();
  if (time < startToday.getTime()) return "neg";
  if (time < startToday.getTime() + 2 * 86_400_000) return "copper";
  return "neutral";
}

export default async function MyPanelPage() {
  const user = await requirePagePermission(permissions.dashboard);

  const [tasks, projects, leads, clients, notifications, selfNotes] = await Promise.all([
    listTasks(),
    genericList<Project>("projects"),
    listLeads(),
    listClients(),
    notificationsForUser(user.id, 8),
    listSelfNotes(user.id),
  ]);

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const clientName = (id: string | null) => clients.find((client) => client.id === id)?.company_name ?? "Internal";

  const myTasks = tasks.filter((task) => task.assigned_to === user.id);
  const myOpen = myTasks.filter((task) => !["DONE", "SCRAPPED"].includes(task.status));
  const todo = myTasks.filter((task) => task.status === "TO_DO");
  const inProgress = myTasks.filter((task) => inProgressStatuses.includes(task.status));
  const dueToday = myOpen.filter((task) => sameDay(task.due_date, startToday));
  const overdue = myOpen.filter((task) => task.due_date && new Date(task.due_date).getTime() < startToday.getTime());
  const completedThisMonth = myTasks.filter((task) => task.status === "DONE" && isInMonthOffset(task.completed_at, 0));

  const myProjects = projects.filter((project) => project.assigned_to === user.id);
  const myActiveProjects = myProjects.filter((project) => project.status !== "COMPLETED");

  // Weekly workload from real task durations (duration_minutes), bucketed by due day.
  const weekStart = startOfWeekMonday(now);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
  const dayMinutes = weekDays.map((day) => myOpen.filter((task) => sameDay(task.due_date, day)).reduce((sum, task) => sum + (task.duration_minutes || 0), 0));
  const maxMinutes = Math.max(...dayMinutes, 1);
  const workloadDays = weekDays.map((day, index) => ({
    label: day.toLocaleDateString("en", { weekday: "short" }),
    sub: String(day.getDate()),
    hoursLabel: hoursLabel(dayMinutes[index]),
    fill: (dayMinutes[index] / maxMinutes) * 100,
    active: sameDay(now.toISOString(), day),
  }));
  const weekTotalMinutes = dayMinutes.reduce((sum, value) => sum + value, 0);

  // Required actions: my overdue tasks, my review-needed tasks, my due lead follow-ups.
  type ActionItem = { id: string; title: string; subtitle: string; date: string | null; icon: LucideIcon; tone: Tone; href: string; cta: string };
  const requiredActions: ActionItem[] = [
    ...overdue.map((task) => ({ id: `overdue-${task.id}`, title: task.title, subtitle: `Overdue · ${clientName(task.client_id)}`, date: task.due_date, icon: AlertTriangle, tone: "neg" as Tone, href: `/tasks/${task.id}`, cta: "Open" })),
    ...myOpen.filter((task) => task.status === "REVIEW_NEEDED").map((task) => ({ id: `review-${task.id}`, title: task.title, subtitle: `Review needed · ${clientName(task.client_id)}`, date: task.due_date, icon: ClipboardCheck, tone: "copper" as Tone, href: `/tasks/${task.id}`, cta: "Review" })),
    ...leads.filter((lead) => lead.assigned_to === user.id && lead.follow_up_date && new Date(lead.follow_up_date).getTime() <= now.getTime()).map((lead) => ({ id: `lead-${lead.id}`, title: lead.company_name, subtitle: `Follow-up due · ${lead.next_action ?? "No next action"}`, date: lead.follow_up_date, icon: Target, tone: "copper" as Tone, href: `/leads/${lead.id}`, cta: "Open" })),
  ]
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
    .slice(0, 6);

  const unreadNotifications = notifications.filter((note) => note.status === "UNREAD").length;

  const timeOnly = (value: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const todayItems = [
    ...myOpen.filter((task) => sameDay(task.due_date, startToday)).map((task) => ({ id: task.id, title: task.title, date: task.due_date as string, kind: "Task", href: `/tasks/${task.id}` })),
    ...myActiveProjects.filter((project) => sameDay(project.deadline, startToday)).map((project) => ({ id: `proj-${project.id}`, title: project.name, date: project.deadline as string, kind: "Deadline", href: `/projects/${project.id}` })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-accent-cyan">Operator</p>
            <h1 className="font-display text-xl font-bold tracking-tight text-deck-text">My Panel · {user.name}</h1>
          </div>
          <span className="hidden font-mono text-xs text-deck-muted sm:inline">{hoursLabel(weekTotalMinutes)} scheduled this week</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard dense label="My Open Tasks" value={myOpen.length} total={myTasks.length} ringValue={pct(myOpen.length, myTasks.length)} href="/tasks" />
          <KpiCard dense label="Due Today" value={dueToday.length} total={myOpen.length} ringValue={pct(dueToday.length, myOpen.length)} href="/calendar" />
          <KpiCard dense label="Overdue" value={overdue.length} total={myOpen.length} ringValue={pct(overdue.length, myOpen.length)} href="/tasks" />
          <KpiCard dense label="My Projects" value={myActiveProjects.length} total={myProjects.length} ringValue={pct(myActiveProjects.length, myProjects.length)} href="/projects" />
          <KpiCard dense label="Done · MTD" value={completedThisMonth.length} total={completedThisMonth.length + myOpen.length} ringValue={pct(completedThisMonth.length, completedThisMonth.length + myOpen.length)} href="/tasks" />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <DeckCard padding="p-3">
            <PanelHeader title="My Workload · this week" right={<span className="font-mono text-xs text-deck-muted">hours by due day</span>} />
            <div className="mt-2"><WorkloadBars days={workloadDays} /></div>
          </DeckCard>

          <DeckCard padding="p-3">
            <PanelHeader title="Today's Agenda" right={<span className="font-mono text-xs text-deck-muted">{todayItems.length}</span>} />
            {todayItems.length ? (
              <div className="mt-2 grid gap-1.5">
                {todayItems.map((item) => (
                  <a key={item.id} href={item.href} className="flex items-center gap-3 rounded-lg border border-hairline bg-deck-panel/60 px-3 py-1.5 transition hover:border-accent-cyan/30">
                    <span className="w-14 shrink-0 font-mono text-xs text-accent-cyan">{timeOnly(item.date)}</span>
                    <span className="flex-1 truncate text-sm text-deck-text">{item.title}</span>
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider text-deck-muted">{item.kind}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-deck-muted">Nothing scheduled for today.</p>
            )}
          </DeckCard>
        </div>

        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
          <ListPanel title="To-Do" right={<span className="font-mono text-xs text-deck-muted">{todo.length}</span>} viewAllHref="/tasks">
            {todo.length ? todo.map((task) => (
              <ListRow key={task.id} icon={ListTodo} iconTone="neutral" title={task.title} subtitle={clientName(task.client_id)} trailing={<DatePill date={dateShort(task.due_date)} tone={dueTone(task.due_date, startToday)} />} href={`/tasks/${task.id}`} />
            )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">Nothing in your to-do list.</div>}
          </ListPanel>

          <ListPanel title="In Progress" right={<span className="font-mono text-xs text-deck-muted">{inProgress.length}</span>} viewAllHref="/tasks">
            {inProgress.length ? inProgress.map((task) => (
              <ListRow key={task.id} icon={Loader} iconTone="copper" title={task.title} subtitle={clientName(task.client_id)} trailing={<DeckStatusBadge value={task.status} />} href={`/tasks/${task.id}`} />
            )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No tasks in progress.</div>}
          </ListPanel>

          <ListPanel title="My Projects" right={<span className="font-mono text-xs text-deck-muted">{myActiveProjects.length}</span>} viewAllHref="/projects">
            {myActiveProjects.length ? myActiveProjects.map((project) => (
              <ListRow key={project.id} icon={BriefcaseBusiness} iconTone="cyan" title={project.name} subtitle={`${clientName(project.client_id)} · ${project.progress}%`} trailing={<div className="w-20"><ProgressBar value={project.progress} /></div>} href={`/projects/${project.id}`} />
            )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No active projects.</div>}
          </ListPanel>

          <ListPanel title="Action Center" right={<span className="font-mono text-xs text-deck-muted">{requiredActions.length + unreadNotifications}</span>}>
            {requiredActions.map((item) => (
              <ListRow
                key={item.id}
                icon={item.icon}
                iconTone={item.tone}
                title={item.title}
                subtitle={item.subtitle}
                trailing={
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-neg/30 bg-neg/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-neg">Required</span>
                    <a href={item.href} className="rounded-lg border border-accent-cyan/30 px-2 py-1 text-xs font-semibold text-accent-cyan transition hover:bg-accent-cyan/10">{item.cta}</a>
                  </div>
                }
              />
            ))}
            {notifications.map((note) => (
              <ListRow
                key={note.id}
                icon={Bell}
                iconTone={note.status === "UNREAD" ? "copper" : "neutral"}
                title={note.title}
                subtitle={note.body}
                trailing={<span className="font-mono text-[0.6rem] text-deck-muted">{dateShort(note.created_at)}</span>}
              />
            ))}
            {requiredActions.length + notifications.length === 0 ? <div className="px-5 py-8 text-center text-sm text-deck-muted">You&apos;re all clear.</div> : null}
          </ListPanel>
        </div>

        {/* Notes to self */}
        <DeckCard padding="p-4">
          <PanelHeader title="Notes to Self" right={<span className="font-mono text-xs text-deck-muted">{selfNotes.length}</span>} />
          <form action={addSelfNoteAction} className="mt-3 flex items-start gap-2">
            <textarea name="body" required rows={2} placeholder="Jot a note to yourself…" className={`${inputClass} resize-none`} />
            <button type="submit" className="shrink-0 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-deck-bg transition hover:brightness-110">Add</button>
          </form>
          {selfNotes.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
              {selfNotes.map((note) => (
                <div key={note.id} className="group relative rounded-lg border border-hairline bg-deck-panel/60 p-3 pr-8">
                  <div className="flex items-start gap-2">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0 text-accent-copper" />
                    <p className="whitespace-pre-wrap break-words text-sm text-deck-text">{note.body}</p>
                  </div>
                  <p className="mt-1.5 pl-5 font-mono text-[0.6rem] text-deck-muted">{dateShort(note.created_at)}</p>
                  <form action={deleteSelfNoteAction} className="absolute right-1.5 top-1.5">
                    <input type="hidden" name="id" value={note.id} />
                    <button className="grid size-6 place-items-center rounded text-deck-muted transition hover:text-neg" aria-label="Delete note"><Trash2 className="size-3.5" /></button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-deck-muted">No notes yet — your private scratchpad lives here.</p>
          )}
        </DeckCard>
      </div>
    </AppShell>
  );
}
