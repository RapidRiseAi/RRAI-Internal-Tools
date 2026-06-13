import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { listUsers } from "@/lib/data";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function NewLeadPage() {
  await requirePagePermission(permissions.leadsRead);
  const users = await listUsers();
  return (
    <AppShell>
      <PageHeader
        title="Create lead"
        eyebrow="CRM"
        description="Required fields are validated server-side before the lead is saved to Supabase."
      />
      <Card>
        <LeadForm
          users={users.map((user) => ({ id: user.id, name: user.name }))}
        />
      </Card>
    </AppShell>
  );
}
