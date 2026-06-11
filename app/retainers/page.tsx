import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import { money } from "@/lib/format";
import type { Retainer } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Retainers() { const retainers = await genericList<Retainer>("retainers"); return <AppShell><ModulePage eyebrow="Recurring revenue" title="Retainers" description="Track hosting, maintenance, SEO, AI bot, dashboard, portal, automation monitoring and support retainers." metrics={[["Retainers", retainers.length], ["Active MRR", money(retainers.filter((retainer) => retainer.status === "ACTIVE").reduce((sum, retainer) => sum + retainer.monthly_amount_cents, 0))], ["Overdue", retainers.filter((retainer) => retainer.status === "OVERDUE").length], ["Paused", retainers.filter((retainer) => retainer.status === "PAUSED").length], ["Upgrade pending", retainers.filter((retainer) => retainer.status === "UPGRADE_PENDING").length]]} records={retainers.map((retainer) => ({ id: retainer.id, title: retainer.type, subtitle: retainer.client_id, status: retainer.status, value: money(retainer.monthly_amount_cents) }))} emptyTitle="No retainers yet" /></AppShell>; }
