import { AppShell } from "@/components/app-shell";
import { TaskForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { updateTaskStatus } from "@/lib/actions";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { genericList, listClients, listTasks, listUsers } from "@/lib/data";
import { dateShort } from "@/lib/format";
import type { Project } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function TasksPage() {
  await requirePagePermission(permissions.tasksRead);
  const [tasks, users, projects, clients] = await Promise.all([
    listTasks(),
    listUsers(),
    genericList<Project>("projects"),
    listClients(),
  ]);
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  const projectOptions = projects.map((project) => ({
    id: project.id,
    name: project.name,
    client_id: project.client_id,
  }));
  return (
    <AppShell>
      <PageHeader
        eyebrow="Workload"
        title="Tasks"
        description="A clean workload overview. Add tasks from the button and use compact row actions only when status or owner needs to change."
        actions={
          <ModalPanel title="Create task" triggerLabel="Add task">
            <TaskForm
              users={userOptions}
              clients={clients}
              projects={projectOptions}
            />
          </ModalPanel>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Open", tasks.filter((task) => task.status !== "DONE").length],
            [
              "Overdue",
              tasks.filter(
                (task) =>
                  task.due_date &&
                  new Date(task.due_date) < new Date() &&
                  task.status !== "DONE",
              ).length,
            ],
            [
              "Blocked",
              tasks.filter((task) => task.status === "BLOCKED").length,
            ],
            ["Done", tasks.filter((task) => task.status === "DONE").length],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card>
          {tasks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3">Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      id={task.id}
                      key={task.id}
                      className="border-t border-white/10"
                    >
                      <td className="p-3 font-semibold text-white">
                        {task.title}
                      </td>
                      <td>
                        <StatusBadge value={task.status} />
                      </td>
                      <td>
                        <StatusBadge value={task.priority} />
                      </td>
                      <td className="text-slate-300">
                        {task.assignee?.name ?? "Unassigned"}
                      </td>
                      <td className="text-slate-300">
                        {dateShort(task.due_date)}
                      </td>
                      <td className="py-2">
                        <ModalPanel
                          title={`Update ${task.title}`}
                          triggerLabel="Update"
                          variant="ghost"
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <form
                              action={updateTaskStatus}
                              className="grid gap-3"
                            >
                              <input type="hidden" name="id" value={task.id} />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value="/tasks"
                              />
                              <label className="grid gap-2 text-sm text-slate-300">
                                Status
                                <select
                                  className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-2 text-sm"
                                  name="status"
                                  defaultValue={task.status}
                                >
                                  <option value="TO_DO">To Do</option>
                                  <option value="IN_PROGRESS">
                                    In Progress
                                  </option>
                                  <option value="WAITING_FOR_CLIENT">
                                    Waiting Client
                                  </option>
                                  <option value="BLOCKED">Blocked</option>
                                  <option value="DONE">Done</option>
                                </select>
                              </label>
                              <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-rapid-cyan">
                                Save status
                              </button>
                            </form>
                            <form
                              action={updateTaskStatus}
                              className="grid gap-3"
                            >
                              <input type="hidden" name="id" value={task.id} />
                              <input
                                type="hidden"
                                name="status"
                                value={task.status}
                              />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value="/tasks"
                              />
                              <label className="grid gap-2 text-sm text-slate-300">
                                Assignee
                                <select
                                  className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-2 text-sm"
                                  name="assignedToId"
                                  defaultValue={task.assigned_to ?? ""}
                                >
                                  <option value="">Unassigned</option>
                                  {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-rapid-cyan">
                                Save assignee
                              </button>
                            </form>
                          </div>
                        </ModalPanel>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No tasks yet"
              body="Use Add task or book events from clients/leads to populate this workload."
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
