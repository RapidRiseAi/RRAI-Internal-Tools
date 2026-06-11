import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { listUsers } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function NewLeadPage() { const users = await listUsers(); return <AppShell><PageHeader title="Create lead" eyebrow="CRM" description="Required fields are validated server-side before the lead is saved to Supabase." /><Card><LeadForm users={users.map((user) => ({ id: user.id, name: user.name }))} /></Card></AppShell>; }
