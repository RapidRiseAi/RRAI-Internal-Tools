import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RecordCockpit, type CockpitRecord } from "@/components/record-cockpit";
import {
  EmptyState,
  InfoRow,
  LinkButton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { listLeads } from "@/lib/data";
import { dateShort } from "@/lib/format";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";

export const dynamic = "force-dynamic";

const inspectorAction =
  "rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold transition hover:border-rapid-cyan/40 hover:bg-white/5";

export default async function LeadsPage() {
  await requirePagePermission(permissions.leadsRead);
  const leads = await listLeads();
  const records: CockpitRecord[] = leads.map((lead) => ({
    id: lead.id,
    href: `/leads/${lead.id}`,
    title: lead.company_name,
    subtitle: lead.contact_name,
    search: `${lead.company_name} ${lead.contact_name} ${lead.service_interest}`,
    cells: [
      <StatusBadge key="stage" value={lead.stage} />,
      lead.score,
      lead.assignee?.name ?? "Unassigned",
      dateShort(lead.follow_up_date),
    ],
    inspector: (
      <div>
        <h3 className="text-lg font-semibold text-white">{lead.company_name}</h3>
        <p className="text-xs text-slate-500">{lead.contact_name}</p>
        <div className="mt-3">
          <StatusBadge value={lead.stage} />
        </div>
        <div className="mt-4">
          <InfoRow label="Score" value={`${lead.score}/100`} />
          <InfoRow label="Service" value={lead.service_interest} />
          <InfoRow label="Owner" value={lead.assignee?.name ?? "Unassigned"} />
          <InfoRow label="Follow-up" value={dateShort(lead.follow_up_date)} />
          <InfoRow label="Next action" value={lead.next_action ?? "—"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={`${inspectorAction} text-rapid-cyan`} href={`/leads/${lead.id}`}>
            Open
          </Link>
          <Link className={`${inspectorAction} text-slate-200`} href={`/leads/${lead.id}#quote`}>
            Quote
          </Link>
        </div>
      </div>
    ),
  }));
  return (
    <AppShell>
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description="Track stages, scores, service interest, owner, next action and follow-up dates."
        actions={<LinkButton href="/leads/new">Create lead</LinkButton>}
      />
      {leads.length ? (
        <RecordCockpit
          columns={["Company", "Stage", "Score", "Owner", "Follow-up"]}
          gridTemplate="minmax(0,1.5fr) auto 0.5fr 1fr 0.9fr"
          records={records}
          searchPlaceholder="Filter leads by company, contact or service…"
        />
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
