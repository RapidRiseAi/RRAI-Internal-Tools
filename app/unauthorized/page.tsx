import { AppShell } from "@/components/app-shell";
import { EmptyState, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  await requireUser();

  return (
    <AppShell>
      <EmptyState
        title="You do not have access to this area"
        body="Your account is active, but your role does not include the permission required for this page. Contact an administrator if you need access."
        action={<LinkButton href="/dashboard">Return to dashboard</LinkButton>}
      />
    </AppShell>
  );
}
