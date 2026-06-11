import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import type { Project, Task } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Projects() { const [projects, tasks] = await Promise.all([genericList<Project>("projects"), genericList<Task>("tasks")]); return <AppShell><ModulePage eyebrow="Delivery" title="Projects" description="Delivery workflow foundation with project statuses, client links, tasks, checklists, blockers, deadlines and progress." metrics={[["Total projects", projects.length], ["Active", projects.filter((project) => project.status !== "COMPLETED").length], ["Waiting client", projects.filter((project) => project.status === "WAITING_FOR_CLIENT_INFO").length], ["Blocked", projects.filter((project) => project.blocker).length], ["Tasks", tasks.length]]} records={projects.map((project) => ({ id: project.id, title: project.name, subtitle: project.client_id, status: project.status, value: `${project.progress}%` }))} emptyTitle="No projects yet" /></AppShell>; }
