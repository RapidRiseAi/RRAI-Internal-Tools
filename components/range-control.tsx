"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

/** Small dropdown that drives a real query param (the server re-aggregates from it). */
export function RangeControl({ param = "range", options }: { param?: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current = search.get(param) ?? options[0]?.value;

  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label="Time range"
        value={current}
        onChange={(event) => {
          const params = new URLSearchParams(search.toString());
          params.set(param, event.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="appearance-none rounded-lg border border-hairline bg-white/[0.03] py-1.5 pl-3 pr-8 font-mono text-xs text-deck-text outline-none transition hover:border-accent-cyan/40 focus:border-accent-cyan"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-deck-panel text-deck-text">{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-deck-muted" />
    </div>
  );
}
