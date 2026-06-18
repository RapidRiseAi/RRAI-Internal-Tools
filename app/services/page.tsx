import { AppShell } from "@/components/app-shell";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { ServiceForm } from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { listServices } from "@/lib/data";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Services() {
  await requirePagePermission(permissions.settingsManage);

  const services = await listServices();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Services catalogue"
        title="Services catalogue"
        description="Manage service pricing, defaults and descriptions in one canonical catalogue. Every existing service can be edited inline so quotes stay aligned with the latest offer."
        actions={
          <ModalPanel title="Add service" triggerLabel="Add service">
            <ServiceForm />
          </ModalPanel>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Services", services.length],
            ["Active", services.filter((service) => service.is_active).length],
            [
              "AI/Automation",
              services.filter((service) => service.category === "AI & Automation").length,
            ],
            ["Web", services.filter((service) => service.category === "Web").length],
            [
              "Base MRR",
              money(
                services.reduce(
                  (sum, service) => sum + service.base_monthly_cents,
                  0,
                ),
              ),
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Editable Services catalogue</h2>
              <p className="mt-1 text-sm text-slate-400">
                Change names, descriptions, active state and default
                once-off/monthly service pricing without leaving this page.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {services.map((service) => (
              <details
                key={service.id}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{service.name}</p>
                    <p className="text-sm text-slate-400">
                      {service.category} • {service.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-300">
                      {money(service.base_once_off_cents)} /{" "}
                      {money(service.base_monthly_cents)} mo
                    </p>
                    <StatusBadge value={service.is_active ? "ACTIVE" : "INACTIVE"} />
                  </div>
                </summary>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <ServiceForm service={service} />
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
