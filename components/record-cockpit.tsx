"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowUpRight, Search, X } from "lucide-react";

export type CockpitRecord = {
  id: string;
  href: string;
  /** Primary cell (first column) */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Remaining columns, aligned to `columns` after the first label */
  cells: ReactNode[];
  /** Full server-rendered detail shown in the right inspector */
  inspector: ReactNode;
  /** Plain text used for client-side filtering */
  search?: string;
};

type RecordCockpitProps = {
  /** Column header labels, including the primary column first */
  columns: string[];
  /** CSS grid-template-columns for the list rows */
  gridTemplate: string;
  records: CockpitRecord[];
  openLabel?: string;
  searchPlaceholder?: string;
};

/**
 * Control-room master/detail view: a dense, filterable, keyboard-navigable
 * record list on the left and a sticky inspector on the right. Purely a
 * presentation layer — every record carries its own pre-rendered inspector
 * and an `href` to the existing full-page route, so no behaviour changes.
 */
export function RecordCockpit({
  columns,
  gridTemplate,
  records,
  openLabel = "Open",
  searchPlaceholder = "Filter records…",
}: RecordCockpitProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => (record.search ?? "").toLowerCase().includes(q));
  }, [records, query]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((record) => record.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = records.find((record) => record.id === selectedId) ?? null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!filtered.length) return;
    const index = filtered.findIndex((record) => record.id === selectedId);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedId(filtered[Math.min(filtered.length - 1, index + 1)].id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedId(filtered[Math.max(0, index - 1)].id);
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      router.push(selected.href);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.65fr_0.95fr]">
      <div className="rr-glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-rapid-cyan" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <span className="rr-hud shrink-0 text-[0.6rem] text-slate-500">
            {filtered.length}/{records.length}
          </span>
        </div>
        <div
          className="hidden gap-3 px-4 py-2 lg:grid"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((column, index) => (
            <span key={index} className="rr-hud truncate text-[0.58rem] font-semibold text-slate-500">
              {column}
            </span>
          ))}
        </div>
        <div
          className="max-h-[calc(100vh-15rem)] overflow-y-auto outline-none"
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label="Records"
        >
          {filtered.map((record) => {
            const active = record.id === selectedId;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => {
                  setSelectedId(record.id);
                  setSheetOpen(true);
                }}
                aria-current={active ? "true" : undefined}
                className={clsx(
                  "grid w-full items-center gap-3 border-t border-white/[0.06] px-4 py-3 text-left text-sm transition first:border-t-0",
                  active
                    ? "bg-rapid-cyan/[0.07] shadow-[inset_2px_0_0_0_var(--rr-cyan)]"
                    : "hover:bg-white/[0.03]",
                )}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{record.title}</span>
                  {record.subtitle ? (
                    <span className="block truncate text-xs text-slate-500">{record.subtitle}</span>
                  ) : null}
                </span>
                {record.cells.map((cell, index) => (
                  <span key={index} className="hidden min-w-0 truncate text-slate-300 lg:block">
                    {cell}
                  </span>
                ))}
              </button>
            );
          })}
          {!filtered.length ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              No matches for “{query}”.
            </p>
          ) : null}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="rr-glass sticky top-24 rounded-2xl p-5">
          {selected ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="rr-hud text-[0.58rem] text-slate-500">Inspector</span>
                <Link
                  href={selected.href}
                  className="inline-flex items-center gap-1 rounded-lg border border-rapid-cyan/30 bg-rapid-cyan/10 px-2.5 py-1 text-xs font-semibold text-rapid-cyan transition hover:bg-rapid-cyan/15"
                >
                  {openLabel} <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              {selected.inspector}
            </>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Select a record to inspect.</p>
          )}
        </div>
      </aside>

      {sheetOpen && selected ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close inspector"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-950/95 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <Link
                href={selected.href}
                className="inline-flex items-center gap-1 rounded-lg border border-rapid-cyan/30 bg-rapid-cyan/10 px-2.5 py-1 text-xs font-semibold text-rapid-cyan"
              >
                {openLabel} <ArrowUpRight className="size-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-300"
              >
                <X className="size-4" />
              </button>
            </div>
            {selected.inspector}
          </div>
        </div>
      ) : null}
    </div>
  );
}
