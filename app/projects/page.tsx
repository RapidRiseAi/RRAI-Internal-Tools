import Link from "next/link";
import type { ComponentProps } from "react";
import { AppShell } from "@/components/app-shell";
import { ProjectForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { BarList, DeckCard, PanelHeader } from "@/components/command-deck";
import { DonutChart } from "@/components/deck-charts";
import { genericList, listChecklistTemplates, listClients, listUsers } from "@/lib/data";
import { distribution } from "@/lib/deck-metrics";
import type { ChecklistTemplate, Project, Quote, Task } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
type ProjectFormWithChecklistProps = ComponentProps<typeof ProjectForm> & { checklistTemplates?: ChecklistTemplate[] };
const ProjectFormWithChecklist = ProjectForm as (props: ProjectFormWithChecklistProps) => ReturnType<typeof ProjectForm>;
export default async function Projects() {
  await requirePagePermission(permissions.projectsRead);
  const [projects, tasks, clients, quotes, users, checklistTemplates] = await Promise.all([
    genericList<Project>("projects"),
    genericList<Task>("tasks"),
    listClients(),
    genericList<Quote>("quotes"),
    listUsers(),
    listChecklistTemplates(),
  ]);
  const activeProjects = projects.filter(
    (project) => project.status !== "COMPLETED",
  );
  return (
    <AppShell>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description="Project stats and active delivery work first. Create projects only when needed from the action button."
        actions={
          <ModalPanel title="Create project" triggerLabel="Add project">
            <ProjectFormWithChecklist clients={clients} quotes={quotes} users={users} checklistTemplates={checklistTemplates} />
          </ModalPanel>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Total projects", projects.length],
            ["Active", activeProjects.length],
            [
              "Waiting client",
              projects.filter(
                (project) => project.status === "WAITING_FOR_CLIENT_INFO",
              ).length,
            ],
            ["Blocked", projects.filter((project) => project.blocker).length],
            [
              "Open tasks",
              tasks.filter((task) => task.status !== "DONE").length,
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        {projects.length ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <DeckCard padding="p-4"><PanelHeader title="Projects by Status" /><div className="mt-3"><BarList items={distribution(projects, (project) => project.status)} tone="cyan" /></div></DeckCard>
            <DeckCard padding="p-4"><PanelHeader title="Tasks by Status" /><div className="mt-3"><BarList items={distribution(tasks, (task) => task.status)} tone="copper" /></div></DeckCard>
            <DeckCard padding="p-4">
              <PanelHeader title="Delivery Health" />
              <div className="mt-4">
                <DonutChart
                  centerLabel={String(projects.length)}
                  centerSub="projects"
                  segments={[
                    { label: "Active", value: activeProjects.filter((project) => !project.blocker).length, color: "var(--deck-accent-cyan)" },
                    { label: "Blocked", value: projects.filter((project) => project.blocker).length, color: "var(--deck-neg)" },
                    { label: "Completed", value: projects.filter((project) => project.status === "COMPLETED").length, color: "var(--deck-pos)" },
                  ].filter((segment) => segment.value > 0)}
                />
              </div>
            </DeckCard>
          </div>
        ) : null}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Active projects
            </h2>
            <span className="text-xs text-slate-500">
              Open a project for checklist, files, URLs and tasks
            </span>
          </div>
          {activeProjects.length ? (
            <div className="grid gap-3">
              {activeProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 p-4 hover:bg-white/[0.06]"
                >
                  <div>
                    <p className="font-semibold text-white">{project.name}</p>
                    <p className="text-sm text-slate-400">
                      {project.progress}% complete •{" "}
                      {project.blocker ?? "No blocker"}
                    </p>
                  </div>
                  <StatusBadge value={project.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active projects"
              body="Accept a quote or use Add project to begin delivery."
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
