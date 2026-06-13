import { AppShell } from "@/components/app-shell";
import { AffiliateForm, ReferralCommissionForms } from "@/components/forms";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import {
  genericList,
  listClients,
  listCommissions,
  listLeads,
  listPayments,
  listReferrals,
} from "@/lib/data";
import { money } from "@/lib/format";
import type { Affiliate, Project, Quote } from "@/lib/types";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function Affiliates() {
  await requirePagePermission(permissions.marketingRead);
  const [
    affiliates,
    referrals,
    commissions,
    leads,
    clients,
    quotes,
    projects,
    payments,
  ] = await Promise.all([
    genericList<Affiliate>("affiliates"),
    listReferrals(),
    listCommissions(),
    listLeads(),
    listClients(),
    genericList<Quote>("quotes"),
    genericList<Project>("projects"),
    listPayments(),
  ]);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Partners"
        title="Affiliates"
        description="Manage partner profiles, safe tracking codes, referrals, payable commissions and payment readiness."
      />
      <div className="grid gap-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Create affiliate</h2>
          <AffiliateForm />
        </Card>
        {affiliates.length ? (
          <ReferralCommissionForms
            affiliates={affiliates}
            leads={leads}
            clients={clients}
            quotes={quotes}
            projects={projects}
            payments={payments}
          />
        ) : null}
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Affiliates", affiliates.length],
            [
              "Active",
              affiliates.filter((affiliate) => affiliate.status === "ACTIVE")
                .length,
            ],
            ["Referrals", referrals.length],
            [
              "Pending commissions",
              commissions.filter((commission) => commission.status !== "PAID")
                .length,
            ],
            [
              "Payable",
              money(
                commissions
                  .filter((commission) =>
                    ["PAYABLE", "APPROVED"].includes(commission.status),
                  )
                  .reduce(
                    (sum, commission) => sum + commission.amount_cents,
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
          <div className="grid gap-3">
            {affiliates.map((affiliate) => (
              <div
                key={affiliate.id}
                className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3"
              >
                <div>
                  <p className="font-semibold text-white">{affiliate.name}</p>
                  <p className="text-sm text-slate-400">
                    {affiliate.email} • /?ref={affiliate.tracking_code} •{" "}
                    {affiliate.default_commission_rate}%
                  </p>
                </div>
                <StatusBadge value={affiliate.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
