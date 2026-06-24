"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Square } from "lucide-react";
import { clockOutAction } from "@/lib/actions";

function elapsedLabel(startMs: number, nowMs: number) {
  const total = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Persistent clock in the top bar: live timer + stop when running, else a clock-in link. */
export function TimeClock({ running }: { running: { startedAt: string; taskTitle: string | null } | null }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (!running) {
    return (
      <Link href="/time" className="hidden items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-deck-muted transition hover:text-deck-text sm:inline-flex">
        <Clock className="size-3.5" /> Clock in
      </Link>
    );
  }

  const start = new Date(running.startedAt).getTime();
  return (
    <div className="hidden items-center gap-2 rounded-lg border border-pos/30 bg-pos/10 px-2.5 py-1.5 sm:inline-flex" title={running.taskTitle ?? "Tracking time"}>
      <span className="size-2 rounded-full bg-pos deck-live-dot" />
      <span className="font-mono text-xs font-semibold tabular-nums text-pos">{now ? elapsedLabel(start, now) : "…"}</span>
      <button
        type="button"
        disabled={stopping}
        onClick={async () => {
          setStopping(true);
          await clockOutAction(new FormData());
          router.refresh();
        }}
        className="grid size-5 place-items-center rounded text-pos/80 transition hover:text-pos disabled:opacity-50"
        aria-label="Clock out"
      >
        <Square className="size-3 fill-current" />
      </button>
    </div>
  );
}
