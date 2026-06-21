"use client";

import { useEffect, useState } from "react";

export function SystemClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" })
    : "—";

  return (
    <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 lg:flex">
      <span className="rr-dot" />
      <div className="leading-tight">
        <p className="rr-hud text-[0.85rem] font-semibold tabular-nums text-white">{time}</p>
        <p className="text-[0.6rem] text-slate-500">{date}</p>
      </div>
    </div>
  );
}
