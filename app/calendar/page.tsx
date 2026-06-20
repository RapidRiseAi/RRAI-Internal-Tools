import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients, listTasks } from "@/lib/data";
import { dateTimeShort, money } from "@/lib/format";
import type { Expense, Invoice, Project, Retainer, Task } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";

export const dynamic = "force-dynamic";

const hours = Array.from({ length: 24 }, (_, index) => index);
const inactiveTaskStatuses = new Set(["SCRAPPED"]);

type CalendarItem = {
  id: string;
  title: string;
  date: string;
  kind:
    | "Task"
    | "Recurring task"
    | "Project deadline"
    | "Invoice due"
    | "Retainer due"
    | "Expense due";
  priority: string;
  description: string | null;
  href?: string;
  assigneeName?: string;
  clientId?: string | null;
  projectId?: string | null;
  amountCents?: number;
};

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
  if (!dateValue) return false;
  const scheduled = new Date(dateValue);
  return (
    scheduled.getFullYear() === date.getFullYear() &&
    scheduled.getMonth() === date.getMonth() &&
    scheduled.getDate() === date.getDate()
  );
}

function hourOf(dateValue: string | null) {
  if (!dateValue) return 9;
  return new Date(dateValue).getHours();
}

function addRecurringInterval(date: Date, task: Task) {
  const next = new Date(date);
  const interval = Math.max(task.recurrence_interval || 1, 1);
  if (task.recurrence === "WEEKLY") {
    next.setDate(next.getDate() + interval * 7);
    return next;
  }
  const dayOfMonth = task.recurrence_day_of_month ?? next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + interval);
  next.setDate(
    Math.min(
      dayOfMonth,
      new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate(),
    ),
  );
  return next;
}

function hasActualOccurrence(
  tasks: Task[],
  parentId: string,
  occurrenceDate: Date,
) {
  return tasks.some(
    (task) =>
      task.recurrence_parent_task_id === parentId &&
      sameDay(task.due_date, occurrenceDate),
  );
}

function recurringOccurrencesForWeek(
  task: Task,
  tasks: Task[],
  weekStart: Date,
  weekEnd: Date,
): CalendarItem[] {
  if (task.recurrence === "NONE" || inactiveTaskStatuses.has(task.status))
    return [];
  const firstDate = task.due_date ?? task.recurrence_next_due_at;
  if (!firstDate) return [];
  const occurrences: CalendarItem[] = [];
  let cursor = new Date(firstDate);
  let guard = 0;
  while (cursor < weekStart && guard < 370) {
    cursor = addRecurringInterval(cursor, task);
    guard += 1;
  }
  while (cursor <= weekEnd && guard < 740) {
    const isBaseTaskDate = task.due_date
      ? sameDay(task.due_date, cursor)
      : false;
    if (!isBaseTaskDate && !hasActualOccurrence(tasks, task.id, cursor)) {
      occurrences.push({
        id: `${task.id}-${cursor.toISOString()}`,
        title: task.title,
        date: cursor.toISOString(),
        kind: "Recurring task",
        priority: task.priority,
        description: task.description,
        href: `/tasks/${task.id}`,
        assigneeName: task.assignee?.name ?? "Unassigned",
        clientId: task.client_id,
        projectId: task.project_id,
      });
    }
    cursor = addRecurringInterval(cursor, task);
    guard += 1;
  }
  return occurrences;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePagePermission(permissions.tasksRead);
  const params = await searchParams;
  const focusDate = params.date
    ? new Date(`${params.date}T00:00:00`)
    : new Date();
  const weekStart = startOfWeek(focusDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });

  const weekEnd = new Date(days[6]);
  weekEnd.setHours(23, 59, 59, 999);

  const [tasks, clients, projects, invoices, retainers, expenses] =
    await Promise.all([
      listTasks(),
      listClients(),
      genericList<Project>("projects"),
      genericList<Invoice>("invoices"),
      genericList<Retainer>("retainers"),
      genericList<Expense>("expenses"),
    ]);
  const taskItems: CalendarItem[] = tasks
    .filter((task) => task.due_date && !inactiveTaskStatuses.has(task.status))
    .map((task) => ({
      id: task.id,
      title: task.title,
      date: task.due_date!,
      kind: task.recurrence === "NONE" ? "Task" : "Recurring task",
      priority: task.priority,
      description: task.description,
      href: `/tasks/${task.id}`,
      assigneeName: task.assignee?.name ?? "Unassigned",
      clientId: task.client_id,
      projectId: task.project_id,
    }));
  const recurringItems = tasks.flatMap((task) =>
    recurringOccurrencesForWeek(task, tasks, weekStart, weekEnd),
  );
  const projectItems: CalendarItem[] = projects
    .filter((project) => project.deadline && project.status !== "COMPLETED")
    .map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      date: project.deadline!,
      kind: "Project deadline",
      priority: project.priority,
      description: project.blocker ? `Blocker: ${project.blocker}` : null,
      href: `/projects/${project.id}`,
      projectId: project.id,
      clientId: project.client_id,
    }));
  const invoiceItems: CalendarItem[] = invoices
    .filter(
      (invoice) =>
        invoice.due_date &&
        !["PAID", "CANCELLED", "REFUNDED"].includes(invoice.status),
    )
    .map((invoice) => ({
      id: `invoice-${invoice.id}`,
      title: `Invoice ${invoice.invoice_number}`,
      date: invoice.due_date!,
      kind: "Invoice due",
      priority: invoice.status === "OVERDUE" ? "URGENT" : "HIGH",
      description: `${invoice.status} • ${money(invoice.amount_cents)}`,
      href: `/billing`,
      clientId: invoice.client_id,
      amountCents: invoice.amount_cents,
    }));
  const retainerItems: CalendarItem[] = retainers
    .filter(
      (retainer) =>
        retainer.next_billing_date &&
        ["ACTIVE", "OVERDUE", "TRIAL", "UPGRADE_PENDING"].includes(
          retainer.status,
        ),
    )
    .map((retainer) => ({
      id: `retainer-${retainer.id}`,
      title: `${retainer.type} retainer`,
      date: retainer.next_billing_date!,
      kind: "Retainer due",
      priority: retainer.status === "OVERDUE" ? "URGENT" : "MEDIUM",
      description: `${retainer.status} • ${money(retainer.monthly_amount_cents)}`,
      href: `/retainers`,
      clientId: retainer.client_id,
      amountCents: retainer.monthly_amount_cents,
    }));
  const expenseItems: CalendarItem[] = expenses
    .filter(
      (expense) =>
        (expense.next_due_date ?? expense.expense_date) &&
        expense.status !== "PAID",
    )
    .map((expense) => ({
      id: `expense-${expense.id}`,
      title: expense.vendor,
      date: (expense.next_due_date ?? expense.expense_date)!,
      kind: "Expense due",
      priority: expense.status === "REJECTED" ? "LOW" : "MEDIUM",
      description: `${expense.category} • ${expense.expense_type} • ${money(expense.amount_cents)}`,
      href: `/billing`,
      clientId: expense.client_id,
      projectId: expense.project_id,
      amountCents: expense.amount_cents,
    }));
  const scheduledTasks = [
    ...taskItems,
    ...recurringItems,
    ...projectItems,
    ...invoiceItems,
    ...retainerItems,
    ...expenseItems,
  ];
  const selectedDay =
    days.find((day) => isoDate(day) === params.date) ??
    days.find((day) => sameDay(new Date().toISOString(), day)) ??
    days[0];
  const selectedTasks = scheduledTasks
    .filter((task) => sameDay(task.date, selectedDay))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
        actions={
          <>
            <Link
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
              href={`/calendar?date=${isoDate(previous)}`}
            >
              Previous week
            </Link>
            <Link
              className="rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 text-sm font-semibold text-white"
              href={`/calendar?date=${isoDate(next)}`}
            >
              Next week
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[4.5rem_repeat(7,minmax(8rem,1fr))] border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wider text-slate-400">
            <div className="p-3">Time</div>
            {days.map((day) => {
              const dayTasks = scheduledTasks.filter((task) =>
                sameDay(task.date, day),
              );
              const owners = new Set(
                dayTasks.map((task) => task.assigneeName).filter(Boolean),
              );
              return (
                <Link
                  key={isoDate(day)}
                  href={`/calendar?date=${isoDate(day)}`}
                  className="border-l border-white/10 p-3 text-center hover:bg-white/8"
                >
                  <span className="block text-slate-200">
                    {day.toLocaleDateString("en", { weekday: "short" })}
                  </span>
                  <span className="text-lg text-white">{day.getDate()}</span>
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {dayTasks.length} tasks • {owners.size} owners
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="max-h-[68vh] overflow-auto">
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid min-h-24 grid-cols-[4.5rem_repeat(7,minmax(8rem,1fr))] border-b border-white/10 last:border-b-0"
              >
                <div className="bg-white/[0.02] p-3 text-xs text-slate-500">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {days.map((day) => {
                  const hourTasks = scheduledTasks.filter(
                    (task) =>
                      sameDay(task.date, day) && hourOf(task.date) === hour,
                  );
                  return (
                    <Link
                      key={`${isoDate(day)}-${hour}`}
                      href={`/calendar?date=${isoDate(day)}`}
                      className="block border-l border-white/10 p-2 hover:bg-white/[0.03]"
                    >
                      {hourTasks.map((task) => (
                        <span
                          key={task.id}
                          className="mb-2 block rounded-xl border border-rapid-cyan/20 bg-rapid-blue/15 p-2 text-xs hover:bg-rapid-blue/25"
                        >
                          <span className="font-semibold text-white">
                            {task.title}
                          </span>
                          <span className="mt-1 block text-slate-300">
                            {task.assigneeName ?? task.kind}
                          </span>
                        </span>
                      ))}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 content-start">
          <Card>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rapid-cyan">
              Selected day
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {selectedDay.toLocaleDateString("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Click any day in the calendar to see who has to do what, with
              links back to the task and related client or project.
            </p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-white">
              Tasks & bookings
            </h3>
            <div className="mt-4 grid gap-3">
              {selectedTasks.length ? (
                selectedTasks.map((task) => {
                  const client = clients.find(
                    (item) => item.id === task.clientId,
                  );
                  const project = projects.find(
                    (item) => item.id === task.projectId,
                  );
                  return (
                    <div
                      id={task.id}
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={
                            task.href ??
                            `/calendar?date=${isoDate(selectedDay)}`
                          }
                          className="font-semibold text-white hover:text-rapid-cyan"
                        >
                          {task.title}
                        </Link>
                        <StatusBadge value={task.priority} />
                        <StatusBadge value={task.kind} />
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {task.description ?? "No description yet."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-slate-200">
                          {task.assigneeName ?? task.kind}
                        </span>
                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-slate-200">
                          {dateTimeShort(task.date)}
                        </span>
                        {client ? (
                          <Link
                            className="rounded-full bg-rapid-cyan/10 px-2.5 py-1 text-rapid-cyan"
                            href={`/clients/${client.id}`}
                          >
                            {client.company_name}
                          </Link>
                        ) : null}
                        {project ? (
                          <Link
                            className="rounded-full bg-rapid-cyan/10 px-2.5 py-1 text-rapid-cyan"
                            href={`/projects/${project.id}`}
                          >
                            {project.name}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">
                  No scheduled tasks for this day.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
