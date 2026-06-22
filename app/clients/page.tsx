import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { BarList, DeckCard, PanelHeader } from "@/components/command-deck";
import { listClients } from "@/lib/data";
import { money } from "@/lib/format";
import { distribution } from "@/lib/deck-metrics";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function ClientsPage() {
  await requirePagePermission(permissions.clientsRead);
  const clients = await listClients();
  const totalMrr = clients.reduce((sum, client) => sum + client.mrr_cents, 0);
  const topMrr = [...clients].filter((client) => client.mrr_cents > 0).sort((a, b) => b.mrr_cents - a.mrr_cents).slice(0, 6).map((client) => ({ label: client.company_name, value: Math.round(client.mrr_cents / 100), sub: money(client.mrr_cents) }));
  return (
    <AppShell>
      <PageHeader
        eyebrow="Accounts"
        title="Clients"
        description="Central client profiles for contacts, services, projects, retainers, files, notes and support."
        actions={<LinkButton href="/clients/new">Create client</LinkButton>}
      />
      {clients.length ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DeckCard padding="p-4"><PanelHeader title="By Status" /><div className="mt-3"><BarList items={distribution(clients, (client) => client.account_status)} tone="cyan" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="By Industry" /><div className="mt-3"><BarList items={distribution(clients, (client) => client.industry ?? "Unknown")} tone="copper" /></div></DeckCard>
          <DeckCard padding="p-4"><PanelHeader title="Top MRR" right={<span className="font-mono text-xs text-deck-muted">{money(totalMrr)}</span>} /><div className="mt-3"><BarList items={topMrr} tone="mixed" /></div></DeckCard>
        </div>
      ) : null}
      {clients.length ? (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full bg-white/[0.035] text-sm">
            <thead className="bg-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-4">Client</th>
                <th>Status</th>
                <th>MRR</th>
                <th>Email</th>
                <th>Next action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-white/10">
                  <td className="p-4">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-semibold text-white"
                    >
                      {client.company_name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {client.industry ?? "No industry"}
                    </p>
                  </td>
                  <td>
                    <StatusBadge value={client.account_status} />
                  </td>
                  <td>{money(client.mrr_cents)}</td>
                  <td>{client.primary_email ?? "—"}</td>
                  <td className="text-slate-400">
                    {client.next_action ?? "—"}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-rapid-cyan"
                        href={`/clients/${client.id}`}
                      >
                        Open
                      </Link>
                      <Link
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200"
                        href={`/clients/${client.id}#quote`}
                      >
                        Quote
                      </Link>
                      <Link
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200"
                        href={`/clients/${client.id}#project`}
                      >
                        Project
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
          title="No clients yet"
          body="Convert a won lead or create a client profile manually."
          action={<LinkButton href="/clients/new">Create client</LinkButton>}
        />
      )}
    </AppShell>
  );
}
