export default function Loading() {
  return <div role="status" className="grid animate-pulse gap-5" aria-label="Loading affiliate operations">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-xl border border-hairline bg-deck-panel/70" />)}</div>
    <div className="h-72 rounded-xl border border-hairline bg-deck-panel/70" />
    <div className="grid gap-4 xl:grid-cols-2"><div className="h-96 rounded-xl border border-hairline bg-deck-panel/70" /><div className="h-96 rounded-xl border border-hairline bg-deck-panel/70" /></div>
    <span className="sr-only">Loading affiliate program data…</span>
  </div>;
}
