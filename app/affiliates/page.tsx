import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import type { Affiliate } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Affiliates() { const affiliates = await genericList<Affiliate>("affiliates"); return <AppShell><ModulePage eyebrow="Partners" title="Affiliates" description="Partner profiles, tracking codes, referred leads, closed clients, commission status and payment history." metrics={[["Affiliates", affiliates.length], ["Active", affiliates.filter((affiliate) => affiliate.status === "ACTIVE").length], ["Paused", affiliates.filter((affiliate) => affiliate.status === "PAUSED").length], ["Tracking codes", affiliates.length], ["Pending setup", 0]]} records={affiliates.map((affiliate) => ({ id: affiliate.id, title: affiliate.name, subtitle: affiliate.email, status: affiliate.status, value: affiliate.tracking_code }))} emptyTitle="No affiliates yet" /></AppShell>; }
