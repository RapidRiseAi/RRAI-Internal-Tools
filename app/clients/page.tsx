import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RecordCockpit, type CockpitRecord } from "@/components/record-cockpit";
import {
  EmptyState,
  InfoRow,
  LinkButton,
  PageHeader,
  StatTile,
  StatusBadge,
} from "@/components/ui";
import { listClients } from "@/lib/data";
import { money } from "@/lib/format";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";

const inspectorAction =
  "rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold transition hover:border-rapid-cyan/40 hover:bg-white/5";

export default async function ClientsPage() {
  await requirePagePermission(permissions.clientsRead);
  const clients = await listClients();
  const records: CockpitRecord[] = clients.map((client) => ({
    id: client.id,
    href: `/clients/${client.id}`,
    title: client.company_name,
    subtitle: client.industry ?? "No industry",
    search: `${client.company_name} ${client.industry ?? ""} ${client.primary_email ?? ""}`,
    cells: [
      <StatusBadge key="status" value={client.account_status} />,
      money(client.mrr_cents),
      client.next_action ?? "—",
    ],
    inspector: (
      <div>
        <h3 className="text-lg font-semibold text-white">{client.company_name}</h3>
        <p className="text-xs text-slate-500">{client.industry ?? "No industry"}</p>
        <div className="mt-3">
          <StatusBadge value={client.account_status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatTile label="MRR" value={money(client.mrr_cents)} />
          <StatTile label="Status" value={client.account_status} />
        </div>
        <div className="mt-3">
          <InfoRow label="Email" value={client.primary_email ?? "—"} />
          <InfoRow label="Next action" value={client.next_action ?? "—"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={`${inspectorAction} text-rapid-cyan`} href={`/clients/${client.id}`}>
            Open
          </Link>
          <Link className={`${inspectorAction} text-slate-200`} href={`/clients/${client.id}#quote`}>
            Quote
          </Link>
          <Link className={`${inspectorAction} text-slate-200`} href={`/clients/${client.id}#project`}>
            Project
          </Link>
        </div>
      </div>
    ),
  }));
  return (
    <AppShell>
      <PageHeader
        eyebrow="Accounts"
        title="Clients"
        description="Central client profiles for contacts, services, projects, retainers, files, notes and support."
        actions={<LinkButton href="/clients/new">Create client</LinkButton>}
      />
      {clients.length ? (
        <RecordCockpit
          columns={["Client", "Status", "MRR", "Next action"]}
          gridTemplate="minmax(0,1.6fr) auto 0.7fr 1.1fr"
          records={records}
          searchPlaceholder="Filter clients by name, industry or email…"
        />
      ) : (
        <EmptyState
          title="No clients yet"
          body="Convert a won lead or create a client profile manually."
          action={<LinkButton href="/clients/new">Create client</LinkButton>}
        />
      )}
    </AppShell>
  );
}
