import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProjectForm } from "@/components/forms";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients } from "@/lib/data";
import type { Project, Quote, Task } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Projects() {
  const [projects, tasks, clients, quotes] = await Promise.all([genericList<Project>("projects"), genericList<Task>("tasks"), listClients(), genericList<Quote>("quotes")]);
  return <AppShell><PageHeader eyebrow="Delivery" title="Projects" description="Manage delivery from quote acceptance to launch, handover, maintenance and completion." /><div className="grid gap-6"><Card><h2 className="mb-4 text-lg font-semibold">Create project</h2><ProjectForm clients={clients} quotes={quotes} /></Card><div className="grid gap-4 md:grid-cols-5">{[["Total projects", projects.length], ["Active", projects.filter((project) => project.status !== "COMPLETED").length], ["Waiting client", projects.filter((project) => project.status === "WAITING_FOR_CLIENT_INFO").length], ["Blocked", projects.filter((project) => project.blocker).length], ["Tasks", tasks.length]].map(([label, value]) => <Card key={label}><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold text-white">{value}</p></Card>)}</div><Card>{projects.length ? <div className="grid gap-3">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 p-4 hover:bg-white/[0.06]"><div><p className="font-semibold text-white">{project.name}</p><p className="text-sm text-slate-400">{project.progress}% complete • {project.blocker ?? "No blocker"}</p></div><StatusBadge value={project.status} /></Link>)}</div> : <EmptyState title="No projects yet" body="Accept a quote or create a project manually to begin delivery." />}</Card></div></AppShell>;
}
