import { AffiliateDashboard } from "@/components/affiliate-dashboard";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { loadAffiliateOperations } from "@/lib/affiliate-operations";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  await requirePagePermission(permissions.settingsManage);
  const data = await loadAffiliateOperations();
  const portalUrl = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL
    || "https://affaliate-system.vercel.app/partners";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Partner operations"
        title="Affiliate command centre"
        description="Review verified applicants, manage CRM affiliates, monitor referral performance, and create auditable commission records from one staff-only workspace."
        actions={(
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-hairline bg-white/[0.03] px-4 py-2 text-sm font-semibold text-deck-text transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            Open partner portal
          </a>
        )}
      />
      <AffiliateDashboard data={data} />
    </AppShell>
  );
}
