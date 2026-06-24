import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { BarList, DeckCard, PanelHeader } from "@/components/command-deck";
import { listLeads } from "@/lib/data";
import { dateShort } from "@/lib/format";
import { distribution } from "@/lib/deck-metrics";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requirePagePermission(permissions.leadsRead);
  const leads = await listLeads();
  return (
    <AppShell>
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description="Track stages, scores, service interest, owner, next action and follow-up dates."
        actions={<LinkButton href="/leads/new">Create lead</LinkButton>}
      />
      {leads.length ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DeckCard padding="p-4"><PanelHeader title="By Stage" /><div className="mt-3"><BarList items={distribution(leads, (lead) => lead.stage)} tone="mixed" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="By Source" /><div className="mt-3"><BarList items={distribution(leads, (lead) => lead.source)} tone="cyan" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="By Service Interest" /><div className="mt-3"><BarList items={distribution(leads, (lead) => lead.service_interest)} tone="copper" /></div></DeckCard>
        </div>
      ) : null}
      {leads.length ? (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full border-collapse bg-white/[0.035] text-sm">
            <thead className="bg-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-4">Company</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Service</th>
                <th>Owner</th>
                <th>Follow-up</th>
                <th>Next action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t border-white/10 hover:bg-white/[0.04]"
                >
                  <td className="p-4">
                    <Link
                      className="font-semibold text-white"
                      href={`/leads/${lead.id}`}
                    >
                      {lead.company_name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {lead.contact_name}
                    </p>
                  </td>
                  <td>
                    <StatusBadge value={lead.stage} />
                  </td>
                  <td>{lead.score}</td>
                  <td>{lead.service_interest}</td>
                  <td>{lead.assignee?.name ?? "Unassigned"}</td>
                  <td>{dateShort(lead.follow_up_date)}</td>
                  <td className="max-w-xs text-slate-400">
                    {lead.next_action ?? "—"}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-rapid-cyan"
                        href={`/leads/${lead.id}`}
                      >
                        Open
                      </Link>
                      <Link
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200"
                        href={`/leads/${lead.id}#quote`}
                      >
                        Quote
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No leads yet"
          body="Create the first database-backed lead and assign an owner, stage and next action."
          action={<LinkButton href="/leads/new">Create lead</LinkButton>}
        />
      )}
    </AppShell>
  );
}
