import { AppShell } from "@/components/app-shell";
import { TaskForm } from "@/components/forms";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listTasks, listUsers } from "@/lib/data";
import { dateShort } from "@/lib/format";
import type { Project } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function TasksPage() { const [tasks, users, projects] = await Promise.all([listTasks(), listUsers(), genericList<Project>("projects")]); return <AppShell><PageHeader eyebrow="Workload" title="Tasks" description="Cross-business task system linked to projects and employees, with status, priority and due dates." /><Card><TaskForm users={users.map((user) => ({ id: user.id, name: user.name }))} projects={projects.map((project) => ({ id: project.id, name: project.name }))} /></Card><div className="mt-6 overflow-hidden rounded-2xl border border-white/10"><table className="w-full bg-white/[0.035] text-sm"><thead className="bg-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-4">Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-t border-white/10"><td className="p-4 font-semibold text-white">{task.title}</td><td><StatusBadge value={task.status} /></td><td><StatusBadge value={task.priority} /></td><td>{task.assignee?.name ?? "Unassigned"}</td><td>{dateShort(task.due_date)}</td></tr>)}</tbody></table></div></AppShell>; }
