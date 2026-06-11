import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { listServices } from "@/lib/data";
import { money } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Services() { const services = await listServices(); return <AppShell><ModulePage eyebrow="Catalogue" title="Services & packages" description="Central Rapid Rise AI service catalogue with default pricing, packages, add-ons and checklist-template links." metrics={[["Services", services.length], ["Active", services.filter((service) => service.is_active).length], ["AI/Automation", services.filter((service) => service.category === "AI & Automation").length], ["Web", services.filter((service) => service.category === "Web").length], ["Base MRR", money(services.reduce((sum, service) => sum + service.base_monthly_cents, 0))]]} records={services.map((service) => ({ id: service.id, title: service.name, subtitle: service.description, status: service.is_active ? "ACTIVE" : "INACTIVE", value: money(service.base_once_off_cents) }))} emptyTitle="No services yet" /></AppShell>; }
