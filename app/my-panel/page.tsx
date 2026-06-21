import {
  Activity,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CircleSlash,
  ClipboardCheck,
  ListTodo,
  Loader,
  Target,
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
import { activityByActor, genericList, listClients, listLeads, listTasks, notificationsForUser } from "@/lib/data";
import { dateShort } from "@/lib/format";
import { isInMonthOffset, pct, startOfWeekMonday } from "@/lib/deck-metrics";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

const inProgressStatuses = ["IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_INTERNALLY", "REVIEW_NEEDED"];

const entityIcon: Record<string, LucideIcon> = {
  lead: Target,
  client: BriefcaseBusiness,
  project: BriefcaseBusiness,
  task: ClipboardCheck,
};

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

  const [tasks, projects, leads, clients, activity, notifications] = await Promise.all([
    listTasks(),
    genericList<Project>("projects"),
    listLeads(),
    listClients(),
    activityByActor(user.id, 8),
    notificationsForUser(user.id, 6),
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

  return (
    <AppShell>
      <div className="mb-6">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Operator</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-deck-text">My Panel</h1>
        <p className="mt-1 text-sm text-deck-muted">Everything assigned to you, {user.name} — tasks, workload and signals, live.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="My Open Tasks" value={myOpen.length} total={myTasks.length} ringValue={pct(myOpen.length, myTasks.length)} href="/tasks" />
        <KpiCard label="Due Today" value={dueToday.length} total={myOpen.length} ringValue={pct(dueToday.length, myOpen.length)} href="/calendar" />
        <KpiCard label="Overdue" value={overdue.length} total={myOpen.length} ringValue={pct(overdue.length, myOpen.length)} href="/tasks" />
        <KpiCard label="My Projects" value={myActiveProjects.length} total={myProjects.length} ringValue={pct(myActiveProjects.length, myProjects.length)} href="/projects" />
        <KpiCard label="Done · this month" value={completedThisMonth.length} total={completedThisMonth.length + myOpen.length} ringValue={pct(completedThisMonth.length, completedThisMonth.length + myOpen.length)} href="/tasks" />
      </div>

      <DeckCard className="mt-6">
        <PanelHeader title="My Workload · this week" right={<span className="font-mono text-xs text-deck-muted">{hoursLabel(weekTotalMinutes)} scheduled</span>} />
        <p className="mt-1 text-xs text-deck-muted">Hours derived from your tasks&apos; durations, bucketed by due day.</p>
        <div className="mt-4"><WorkloadBars days={workloadDays} /></div>
      </DeckCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ListPanel title="To-Do" right={<span className="font-mono text-xs text-deck-muted">{todo.length}</span>} viewAllHref="/tasks">
          {todo.length ? todo.slice(0, 7).map((task) => (
            <ListRow
              key={task.id}
              icon={ListTodo}
              iconTone="neutral"
              title={task.title}
              subtitle={clientName(task.client_id)}
              trailing={<div className="flex items-center gap-2"><DeckStatusBadge value={task.priority} /><DatePill date={dateShort(task.due_date)} tone={dueTone(task.due_date, startToday)} /></div>}
              href={`/tasks/${task.id}`}
            />
          )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">Nothing in your to-do list.</div>}
        </ListPanel>

        <ListPanel title="In Progress" right={<span className="font-mono text-xs text-deck-muted">{inProgress.length}</span>} viewAllHref="/tasks">
          {inProgress.length ? inProgress.slice(0, 7).map((task) => (
            <ListRow
              key={task.id}
              icon={Loader}
              iconTone="copper"
              title={task.title}
              subtitle={clientName(task.client_id)}
              trailing={<div className="flex items-center gap-2"><DeckStatusBadge value={task.status} /><DatePill date={dateShort(task.due_date)} tone={dueTone(task.due_date, startToday)} /></div>}
              href={`/tasks/${task.id}`}
            />
          )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No tasks in progress.</div>}
        </ListPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ListPanel title="My Projects" right={<span className="font-mono text-xs text-deck-muted">{myActiveProjects.length} active</span>} viewAllHref="/projects">
          {myActiveProjects.length ? myActiveProjects.slice(0, 6).map((project) => (
            <ListRow
              key={project.id}
              icon={BriefcaseBusiness}
              iconTone="cyan"
              title={project.name}
              subtitle={`${clientName(project.client_id)} · ${project.progress}%`}
              trailing={<div className="w-28"><ProgressBar value={project.progress} /></div>}
              href={`/projects/${project.id}`}
            />
          )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No active projects assigned to you.</div>}
        </ListPanel>

        <ListPanel title="Required Actions" right={<span className="font-mono text-xs text-deck-muted">{requiredActions.length}</span>}>
          {requiredActions.length ? requiredActions.map((item) => (
            <ListRow
              key={item.id}
              icon={item.icon}
              iconTone={item.tone}
              title={item.title}
              subtitle={item.subtitle}
              trailing={<a href={item.href} className="rounded-lg border border-accent-cyan/30 px-3 py-1 text-xs font-semibold text-accent-cyan transition hover:bg-accent-cyan/10">{item.cta}</a>}
            />
          )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">You&apos;re all clear — no actions need you right now.</div>}
        </ListPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ListPanel title="My Recent Activity">
          {activity.length ? activity.map((item) => (
            <ListRow
              key={item.id}
              icon={entityIcon[item.entity_type?.toLowerCase()] ?? Activity}
              iconTone="cyan"
              title={item.message}
              subtitle={item.action.replaceAll("_", " ").toLowerCase()}
              trailing={<span className="font-mono text-xs text-deck-muted">{dateShort(item.created_at)}</span>}
            />
          )) : <div className="px-5 py-8 text-center text-sm text-deck-muted"><CircleSlash className="mx-auto mb-2 size-5 opacity-50" />No recorded activity yet.</div>}
        </ListPanel>

        <ListPanel title="Notifications">
          {notifications.length ? notifications.map((note) => (
            <ListRow
              key={note.id}
              icon={Bell}
              iconTone={note.status === "UNREAD" ? "copper" : "neutral"}
              title={note.title}
              subtitle={note.body}
              trailing={note.status === "UNREAD" ? <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-accent-copper"><CalendarClock className="size-3" />{dateShort(note.created_at)}</span> : <span className="font-mono text-xs text-deck-muted">{dateShort(note.created_at)}</span>}
            />
          )) : <div className="px-5 py-8 text-center text-sm text-deck-muted">No notifications.</div>}
        </ListPanel>
      </div>
    </AppShell>
  );
}
