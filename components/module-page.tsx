import { Card, EmptyState, PageHeader, StatusBadge } from "./ui";

export function ModulePage({ eyebrow, title, description, metrics, records, emptyTitle }: { eyebrow: string; title: string; description: string; metrics: [string, string | number][]; records: { id: string; title: string; subtitle?: string; status?: string; value?: string }[]; emptyTitle: string }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {metrics.map(([label, value]) => (
          <Card key={label} className="rr-scan">
            <p className="rr-hud text-[0.6rem] font-semibold text-slate-400">{label}</p>
            <p className="rr-metric mt-3 text-2xl font-bold text-white">{value}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><span className="rr-dot !size-1.5" /> Operational records</h2>
        {records.length ? (
          <div className="mt-4 grid gap-3">
            {records.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-rapid-cyan/30 hover:bg-slate-950/60">
                <div>
                  <p className="font-semibold text-white">{record.title}</p>
                  {record.subtitle ? <p className="text-sm text-slate-400">{record.subtitle}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  {record.value ? <p className="text-sm font-semibold text-slate-200">{record.value}</p> : null}
                  {record.status ? <StatusBadge value={record.status} /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title={emptyTitle} body="The database schema and protected module shell are in place. Add records through the next phase's specialized workflow screens." />
          </div>
        )}
      </Card>
    </>
  );
}
