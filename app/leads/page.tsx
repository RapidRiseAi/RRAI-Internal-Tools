import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { listLeads } from "@/lib/data";
import { dateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();
  return <AppShell><PageHeader eyebrow="CRM" title="Leads" description="Track stages, scores, service interest, owner, next action and follow-up dates." actions={<LinkButton href="/leads/new">Create lead</LinkButton>} />{leads.length ? <div className="overflow-hidden rounded-2xl border border-white/10"><table className="w-full border-collapse bg-white/[0.035] text-sm"><thead className="bg-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-4">Company</th><th>Stage</th><th>Score</th><th>Service</th><th>Owner</th><th>Follow-up</th><th>Next action</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t border-white/10 hover:bg-white/[0.04]"><td className="p-4"><Link className="font-semibold text-white" href={`/leads/${lead.id}`}>{lead.company_name}</Link><p className="text-xs text-slate-500">{lead.contact_name}</p></td><td><StatusBadge value={lead.stage} /></td><td>{lead.score}</td><td>{lead.service_interest}</td><td>{lead.assignee?.name ?? "Unassigned"}</td><td>{dateShort(lead.follow_up_date)}</td><td className="max-w-xs text-slate-400">{lead.next_action ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No leads yet" body="Create the first database-backed lead and assign an owner, stage and next action." action={<LinkButton href="/leads/new">Create lead</LinkButton>} />}</AppShell>;
}
