import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeckCard, type Tone } from "@/components/command-deck";
import { genericList, listClients, listTasks } from "@/lib/data";
import { money } from "@/lib/format";
import type { Expense, Invoice, Project, Retainer, Task } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { appTimeZone, dateKeyInTimeZone, formatDateTimeLocal } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const inactiveTaskStatuses = new Set(["SCRAPPED"]);
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarItem = {
  id: string;
  title: string;
  date: string;
  kind: "Task" | "Recurring task" | "Project deadline" | "Invoice due" | "Retainer due" | "Expense due";
  priority: string;
  description: string | null;
  href?: string;
  assigneeName?: string;
  clientId?: string | null;
  projectId?: string | null;
  amountCents?: number;
};

const kindTone: Record<CalendarItem["kind"], Tone> = {
  Task: "cyan",
  "Recurring task": "cyan",
  "Project deadline": "copper",
  "Invoice due": "pos",
  "Retainer due": "pos",
  "Expense due": "neg",
};
const toneChip: Record<Tone, string> = {
  cyan: "bg-accent-cyan/10 text-accent-cyan",
  copper: "bg-accent-copper/10 text-accent-copper",
  pos: "bg-pos/10 text-pos",
  neg: "bg-neg/10 text-neg",
  neutral: "bg-white/5 text-deck-muted",
};
const toneDot: Record<Tone, string> = { cyan: "bg-accent-cyan", copper: "bg-accent-copper", pos: "bg-pos", neg: "bg-neg", neutral: "bg-deck-muted" };

const calendarTimeZone = appTimeZone();

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function dayKeyOf(dateValue: string | null) {
  if (!dateValue) return null;
  return dateKeyInTimeZone(dateValue, calendarTimeZone);
}
function sameDay(dateValue: string | null, date: Date) {
  if (!dateValue) return false;
  return dayKeyOf(dateValue) === isoDate(date);
}
function calendarDateTimeShort(dateValue: string) {
  const local = formatDateTimeLocal(dateValue, calendarTimeZone);
  if (!local) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`${local}:00`));
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
  next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  return next;
}
function hasActualOccurrence(tasks: Task[], parentId: string, occurrenceDate: Date) {
  return tasks.some((task) => task.recurrence_parent_task_id === parentId && sameDay(task.due_date, occurrenceDate));
}
function recurringOccurrencesInRange(task: Task, tasks: Task[], rangeStart: Date, rangeEnd: Date): CalendarItem[] {
  if (task.recurrence === "NONE" || inactiveTaskStatuses.has(task.status)) return [];
  const firstDate = task.due_date ?? task.recurrence_next_due_at;
  if (!firstDate) return [];
  const occurrences: CalendarItem[] = [];
  let cursor = new Date(firstDate);
  let guard = 0;
  while (cursor < rangeStart && guard < 600) {
    cursor = addRecurringInterval(cursor, task);
    guard += 1;
  }
  while (cursor <= rangeEnd && guard < 1200) {
    const isBaseTaskDate = task.due_date ? sameDay(task.due_date, cursor) : false;
    if (!isBaseTaskDate && !hasActualOccurrence(tasks, task.id, cursor)) {
      occurrences.push({ id: `${task.id}-${cursor.toISOString()}`, title: task.title, date: cursor.toISOString(), kind: "Recurring task", priority: task.priority, description: task.description, href: `/tasks/${task.id}`, assigneeName: task.assignee?.name ?? "Unassigned", clientId: task.client_id, projectId: task.project_id });
    }
    cursor = addRecurringInterval(cursor, task);
    guard += 1;
  }
  return occurrences;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  await requirePagePermission(permissions.tasksRead);
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "month";
  const focusDate = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
  const today = new Date();

  // Visible day cells: a 6-week grid for the month, or 7 days for the week.
  const gridStart = view === "month" ? startOfWeek(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)) : startOfWeek(focusDate);
  const dayCount = view === "month" ? 42 : 7;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
  const rangeStart = days[0];
  const rangeEnd = new Date(days[days.length - 1]);
  rangeEnd.setHours(23, 59, 59, 999);

  const [tasks, clients, projects, invoices, retainers, expenses] = await Promise.all([
    listTasks(),
    listClients(),
    genericList<Project>("projects"),
    genericList<Invoice>("invoices"),
    genericList<Retainer>("retainers"),
    genericList<Expense>("expenses"),
  ]);

  const taskItems: CalendarItem[] = tasks
    .filter((task) => task.due_date && !inactiveTaskStatuses.has(task.status))
    .map((task) => ({ id: task.id, title: task.title, date: task.due_date!, kind: task.recurrence === "NONE" ? "Task" : "Recurring task", priority: task.priority, description: task.description, href: `/tasks/${task.id}`, assigneeName: task.assignee?.name ?? "Unassigned", clientId: task.client_id, projectId: task.project_id }));
  const recurringItems = tasks.flatMap((task) => recurringOccurrencesInRange(task, tasks, rangeStart, rangeEnd));
  const projectItems: CalendarItem[] = projects
    .filter((project) => project.deadline && project.status !== "COMPLETED")
    .map((project) => ({ id: `project-${project.id}`, title: project.name, date: project.deadline!, kind: "Project deadline", priority: project.priority, description: project.blocker ? `Blocker: ${project.blocker}` : null, href: `/projects/${project.id}`, projectId: project.id, clientId: project.client_id }));
  const invoiceItems: CalendarItem[] = invoices
    .filter((invoice) => invoice.due_date && !["PAID", "CANCELLED", "REFUNDED"].includes(invoice.status))
    .map((invoice) => ({ id: `invoice-${invoice.id}`, title: `Invoice ${invoice.invoice_number}`, date: invoice.due_date!, kind: "Invoice due", priority: invoice.status === "OVERDUE" ? "URGENT" : "HIGH", description: `${invoice.status} • ${money(invoice.amount_cents)}`, href: `/billing`, clientId: invoice.client_id, amountCents: invoice.amount_cents }));
  const retainerItems: CalendarItem[] = retainers
    .filter((retainer) => retainer.next_billing_date && ["ACTIVE", "OVERDUE", "TRIAL", "UPGRADE_PENDING"].includes(retainer.status))
    .map((retainer) => ({ id: `retainer-${retainer.id}`, title: `${retainer.type} retainer`, date: retainer.next_billing_date!, kind: "Retainer due", priority: retainer.status === "OVERDUE" ? "URGENT" : "MEDIUM", description: `${retainer.status} • ${money(retainer.monthly_amount_cents)}`, href: `/retainers`, clientId: retainer.client_id, amountCents: retainer.monthly_amount_cents }));
  const expenseItems: CalendarItem[] = expenses
    .filter((expense) => (expense.next_due_date ?? expense.expense_date) && expense.status !== "PAID")
    .map((expense) => ({ id: `expense-${expense.id}`, title: expense.vendor, date: (expense.next_due_date ?? expense.expense_date)!, kind: "Expense due", priority: "MEDIUM", description: `${expense.category} • ${money(expense.amount_cents)}`, href: `/billing`, clientId: expense.client_id, projectId: expense.project_id, amountCents: expense.amount_cents }));

  const allItems = [...taskItems, ...recurringItems, ...projectItems, ...invoiceItems, ...retainerItems, ...expenseItems];
  const itemsByDay = new Map<string, CalendarItem[]>();
  for (const item of allItems) {
    const key = dayKeyOf(item.date);
    if (!key) continue;
    const bucket = itemsByDay.get(key);
    if (bucket) bucket.push(item);
    else itemsByDay.set(key, [item]);
  }
  for (const bucket of itemsByDay.values()) bucket.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const selectedKey = params.date ?? isoDate(today);
  const selectedItems = itemsByDay.get(selectedKey) ?? [];
  const selectedDate = new Date(`${selectedKey}T00:00:00`);
  const clientName = (id: string | null | undefined) => clients.find((client) => client.id === id)?.company_name ?? null;

  // Navigation targets.
  const prevFocus = view === "month" ? new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1) : new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() - 7);
  const nextFocus = view === "month" ? new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1) : new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 7);
  const navHref = (date: Date) => `/calendar?view=${view}&date=${isoDate(date)}`;
  const title = view === "month"
    ? focusDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold tracking-tight text-deck-text">{title}</h1>
            <div className="flex items-center gap-1">
              <Link href={navHref(prevFocus)} aria-label="Previous" className="grid size-8 place-items-center rounded-lg border border-hairline text-deck-muted transition hover:text-deck-text"><ChevronLeft className="size-4" /></Link>
              <Link href={navHref(today)} className="rounded-lg border border-hairline px-3 py-1.5 font-mono text-xs font-semibold text-deck-muted transition hover:text-deck-text">Today</Link>
              <Link href={navHref(nextFocus)} aria-label="Next" className="grid size-8 place-items-center rounded-lg border border-hairline text-deck-muted transition hover:text-deck-text"><ChevronRight className="size-4" /></Link>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-hairline p-0.5">
            {(["month", "week"] as const).map((option) => (
              <Link key={option} href={`/calendar?view=${option}&date=${selectedKey}`} className={`rounded-md px-3 py-1 font-mono text-xs font-semibold capitalize transition ${view === option ? "bg-accent-cyan/15 text-accent-cyan" : "text-deck-muted hover:text-deck-text"}`}>{option}</Link>
            ))}
          </div>
        </div>

        {/* Calendar + day detail */}
        <div className="grid min-h-0 flex-1 auto-rows-fr gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_21rem]">
          <DeckCard padding="p-3" className="flex min-h-0 flex-col overflow-hidden" glow={false}>
            {view === "month" ? (
              <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1">
                {weekdayLabels.map((label) => (
                  <div key={label} className="pb-1 text-center font-display text-[0.6rem] font-semibold uppercase tracking-wider text-deck-muted">{label}</div>
                ))}
                {days.map((day) => {
                  const key = isoDate(day);
                  const dayItems = itemsByDay.get(key) ?? [];
                  const inMonth = day.getMonth() === focusDate.getMonth();
                  const isToday = key === isoDate(today);
                  const isSelected = key === selectedKey;
                  return (
                    <Link key={key} href={`/calendar?view=month&date=${key}`} className={`flex min-h-0 flex-col gap-0.5 overflow-hidden rounded-lg border p-1 transition ${isSelected ? "border-accent-cyan/60 bg-accent-cyan/[0.06]" : "border-hairline/60 hover:border-hairline hover:bg-white/[0.02]"} ${inMonth ? "" : "opacity-40"}`}>
                      <div className="flex shrink-0 items-center justify-between">
                        <span className={`grid size-5 place-items-center rounded-full font-mono text-[0.65rem] ${isToday ? "bg-accent-cyan font-bold text-deck-bg" : "text-deck-muted"}`}>{day.getDate()}</span>
                        {dayItems.length ? <span className="font-mono text-[0.55rem] text-deck-muted">{dayItems.length}</span> : null}
                      </div>
                      <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                        {dayItems.slice(0, 3).map((item) => (
                          <span key={item.id} className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[0.6rem] ${toneChip[kindTone[item.kind]]}`}>
                            <span className={`size-1 shrink-0 rounded-full ${toneDot[kindTone[item.kind]]}`} />
                            <span className="truncate">{item.title}</span>
                          </span>
                        ))}
                        {dayItems.length > 3 ? <span className="px-1 text-[0.55rem] text-deck-muted">+{dayItems.length - 3} more</span> : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-7 gap-2">
                {days.map((day) => {
                  const key = isoDate(day);
                  const dayItems = itemsByDay.get(key) ?? [];
                  const isToday = key === isoDate(today);
                  const isSelected = key === selectedKey;
                  return (
                    <div key={key} className={`flex min-h-0 flex-col rounded-lg border ${isSelected ? "border-accent-cyan/50" : "border-hairline/60"}`}>
                      <Link href={`/calendar?view=week&date=${key}`} className="shrink-0 border-b border-hairline px-2 py-1.5 text-center transition hover:bg-white/[0.02]">
                        <p className="font-display text-[0.6rem] font-semibold uppercase tracking-wider text-deck-muted">{day.toLocaleDateString("en", { weekday: "short" })}</p>
                        <p className={`font-mono text-sm ${isToday ? "text-accent-cyan" : "text-deck-text"}`}>{day.getDate()}</p>
                      </Link>
                      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
                        {dayItems.map((item) => (
                          <Link key={item.id} href={item.href ?? `/calendar?view=week&date=${key}`} className={`truncate rounded px-1.5 py-1 text-[0.65rem] ${toneChip[kindTone[item.kind]]}`}>
                            <span className="block font-mono text-[0.55rem] opacity-80">{calendarDateTimeShort(item.date)}</span>
                            <span className="truncate">{item.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DeckCard>

          {/* Day detail */}
          <DeckCard padding="p-0" className="flex min-h-0 flex-col overflow-hidden" glow={false}>
            <div className="shrink-0 border-b border-hairline px-4 py-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-accent-cyan">Selected day</p>
              <h2 className="mt-0.5 font-display text-base font-bold text-deck-text">{selectedDate.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</h2>
              <p className="font-mono text-xs text-deck-muted">{selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}</p>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
              {selectedItems.length ? selectedItems.map((item) => {
                const tone = kindTone[item.kind];
                const client = clientName(item.clientId);
                return (
                  <Link key={item.id} href={item.href ?? `/calendar?date=${selectedKey}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${toneDot[tone]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-deck-text">{item.title}</p>
                      <p className="truncate text-xs text-deck-muted">{item.kind}{client ? ` · ${client}` : ""}{item.assigneeName ? ` · ${item.assigneeName}` : ""}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[0.65rem] text-deck-muted">{calendarDateTimeShort(item.date)}</span>
                  </Link>
                );
              }) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-deck-muted">
                  <div><CalendarDays className="mx-auto mb-2 size-6 opacity-50" />Nothing scheduled for this day.</div>
                </div>
              )}
            </div>
          </DeckCard>
        </div>
      </div>
    </AppShell>
  );
}
