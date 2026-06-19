import { AppShell } from "@/components/app-shell";
import { PayrollItemForm, PayrollRunForm, UserForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { genericList, listPayrollItems, listRoles, listUsers } from "@/lib/data";
import { dateShort, money } from "@/lib/format";
import type { PayrollRun } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  await requirePagePermission(permissions.payrollRead);
  const [users, roles, runs, items] = await Promise.all([
    listUsers(),
    listRoles(),
    genericList<PayrollRun>("payroll_runs", "period_end"),
    listPayrollItems(),
  ]);
  const activeEmployees = users.filter((user) => user.status === "ACTIVE");
  const payrollTotal = items.reduce((sum, item) => sum + item.net_pay_cents, 0);
  const currentRun = runs[0];
  const currentRunItems = currentRun
    ? items.filter((item) => item.payroll_run_id === currentRun.id)
    : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="People operations"
        title="Payroll & employees"
        description="Manage employee profiles, specialties, roles, pay rates and payroll runs from one workspace."
        actions={
          <>
            <ModalPanel title="Add employee" triggerLabel="Add employee">
              <UserForm roles={roles} />
            </ModalPanel>
            <ModalPanel title="Create payroll run" triggerLabel="Add payroll run" variant="ghost">
              <PayrollRunForm />
            </ModalPanel>
            <ModalPanel title="Add payroll item" triggerLabel="Add pay item" variant="ghost">
              <PayrollItemForm runs={runs} users={activeEmployees} />
            </ModalPanel>
          </>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Active employees", activeEmployees.length],
            ["Payroll runs", runs.length],
            ["Payroll items", items.length],
            ["Total net pay", money(payrollTotal)],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Employee directory</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <ModalPanel key={user.id} title={`Edit ${user.name}`} triggerLabel={user.name} variant="ghost">
                <div className="mb-4 rounded-xl bg-white/[0.04] p-3 text-sm text-slate-300">
                  <p>{user.title ?? "No title"} • {user.role?.name ?? "No role"}</p>
                  <p>{user.department ?? "No department"} • {user.specialties ?? "No specialties"}</p>
                  <p>{user.pay_type ?? "SALARY"} • {money(user.pay_rate_cents ?? 0)}</p>
                </div>
                <UserForm roles={roles} user={user} />
              </ModalPanel>
            ))}
          </div>
        </Card>
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Payroll runs</h2>
            {runs.length ? (
              <div className="grid gap-3">
                {runs.map((run) => (
                  <div key={run.id} className="rounded-xl bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {dateShort(run.period_start)} — {dateShort(run.period_end)}
                      </p>
                      <StatusBadge value={run.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{run.notes ?? "No notes"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No payroll runs" body="Create a payroll run, then add employee pay items." />
            )}
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">
              {currentRun ? "Current run items" : "Payroll items"}
            </h2>
            <div className="grid gap-3">
              {(currentRun ? currentRunItems : items).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm">
                  <div>
                    <p className="font-semibold text-white">{item.user?.name ?? "Employee"}</p>
                    <p className="text-slate-400">{item.role_snapshot ?? item.user?.title ?? "No role snapshot"} • {item.pay_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{money(item.net_pay_cents)}</p>
                    <p className="text-xs text-slate-500">Gross {money(item.gross_pay_cents)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
