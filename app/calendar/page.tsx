import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients, listTasks, listUsers } from "@/lib/data";
import { dateShort } from "@/lib/format";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

const hours = Array.from({ length: 24 }, (_, index) => index);

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sameDay(dateValue: string | null, date: Date) {
  return dateValue?.slice(0, 10) === isoDate(date);
}

function hourOf(dateValue: string | null) {
  if (!dateValue) return 9;
  return new Date(dateValue).getHours();
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const focusDate = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
  const weekStart = startOfWeek(focusDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });

  const [tasks, users, clients, projects] = await Promise.all([
    listTasks(),
    listUsers(),
    listClients(),
    genericList<Project>("projects"),
  ]);
  const scheduledTasks = tasks.filter((task) => task.due_date && task.status !== "DONE");
  const selectedDay = days.find((day) => isoDate(day) === params.date) ?? days.find((day) => sameDay(new Date().toISOString(), day)) ?? days[0];
  const selectedTasks = scheduledTasks.filter((task) => sameDay(task.due_date, selectedDay));
  const previous = new Date(weekStart);
  previous.setDate(previous.getDate() - 7);
  const next = new Date(weekStart);
  next.setDate(next.getDate() + 7);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Work calendar"
        title="Team schedule"
        description="A simple internal calendar for bookings, follow-ups and delivery tasks. Use it now as the source of truth and connect Google Calendar later."
        actions={<><Link className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10" href={`/calendar?date=${isoDate(previous)}`}>Previous week</Link><Link className="rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 text-sm font-semibold text-white" href={`/calendar?date=${isoDate(next)}`}>Next week</Link></>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[4.5rem_repeat(7,minmax(8rem,1fr))] border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wider text-slate-400">
            <div className="p-3">Time</div>
            {days.map((day) => {
              const dayTasks = scheduledTasks.filter((task) => sameDay(task.due_date, day));
              const owners = new Set(dayTasks.map((task) => task.assigned_to).filter(Boolean));
              return <Link key={isoDate(day)} href={`/calendar?date=${isoDate(day)}`} className="border-l border-white/10 p-3 text-center hover:bg-white/8"><span className="block text-slate-200">{day.toLocaleDateString("en", { weekday: "short" })}</span><span className="text-lg text-white">{day.getDate()}</span><span className="mt-1 block text-[10px] text-slate-500">{dayTasks.length} tasks • {owners.size} owners</span></Link>;
            })}
          </div>
          <div className="max-h-[68vh] overflow-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid min-h-24 grid-cols-[4.5rem_repeat(7,minmax(8rem,1fr))] border-b border-white/10 last:border-b-0">
              <div className="bg-white/[0.02] p-3 text-xs text-slate-500">{String(hour).padStart(2, "0")}:00</div>
              {days.map((day) => {
                const hourTasks = scheduledTasks.filter((task) => sameDay(task.due_date, day) && hourOf(task.due_date) === hour);
                return <Link key={`${isoDate(day)}-${hour}`} href={`/calendar?date=${isoDate(day)}`} className="block border-l border-white/10 p-2 hover:bg-white/[0.03]">{hourTasks.map((task) => <span key={task.id} className="mb-2 block rounded-xl border border-rapid-cyan/20 bg-rapid-blue/15 p-2 text-xs hover:bg-rapid-blue/25"><span className="font-semibold text-white">{task.title}</span><span className="mt-1 block text-slate-300">{task.assignee?.name ?? "Unassigned"}</span></span>)}</Link>;
              })}
            </div>
          ))}
          </div>
        </Card>

        <div className="grid gap-6 content-start">
          <Card>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rapid-cyan">Selected day</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{selectedDay.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</h2>
            <p className="mt-2 text-sm text-slate-400">Click any day in the calendar to see who has to do what, with links back to the task and related client or project.</p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-white">Tasks & bookings</h3>
            <div className="mt-4 grid gap-3">
              {selectedTasks.length ? selectedTasks.map((task) => {
                const client = clients.find((item) => item.id === task.client_id);
                const project = projects.find((item) => item.id === task.project_id);
                const assignee = users.find((item) => item.id === task.assigned_to);
                return <div id={task.id} key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><div className="flex items-start justify-between gap-3"><Link href={`/tasks#${task.id}`} className="font-semibold text-white hover:text-rapid-cyan">{task.title}</Link><StatusBadge value={task.priority} /></div><p className="mt-2 text-sm text-slate-400">{task.description ?? "No description yet."}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/8 px-2.5 py-1 text-slate-200">{assignee?.name ?? "Unassigned"}</span><span className="rounded-full bg-white/8 px-2.5 py-1 text-slate-200">{dateShort(task.due_date)}</span>{client ? <Link className="rounded-full bg-rapid-cyan/10 px-2.5 py-1 text-rapid-cyan" href={`/clients/${client.id}`}>{client.company_name}</Link> : null}{project ? <Link className="rounded-full bg-rapid-cyan/10 px-2.5 py-1 text-rapid-cyan" href={`/projects/${project.id}`}>{project.name}</Link> : null}</div></div>;
              }) : <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">No scheduled tasks for this day.</p>}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
