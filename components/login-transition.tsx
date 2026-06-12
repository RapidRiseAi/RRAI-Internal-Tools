"use client";

import { useEffect, useState } from "react";

export function LoginTransition({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2f7dff55,transparent_34rem),radial-gradient(circle_at_80%_20%,#38d5ff33,transparent_28rem)]" />
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-slate-950/80">
        <div className="h-full w-1/2 animate-[route-progress_1.1s_ease-in-out_infinite] rounded-r-full bg-gradient-to-r from-rapid-blue via-rapid-cyan to-white shadow-[0_0_24px_rgba(56,213,255,0.75)]" />
      </div>
      <div className="absolute inset-x-0 top-8 mx-auto w-fit rounded-full border border-white/10 bg-slate-950/85 px-4 py-2 text-xs font-semibold text-slate-200 shadow-2xl shadow-black/40 backdrop-blur-xl">
        Verifying credentials and opening dashboard…
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-6 pb-10 opacity-90">
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rapid-cyan">Dashboard loading</p>
            <p className="mt-2 text-2xl font-bold text-white">Preparing your command center</p>
          </div>
          <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-rapid-cyan" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {["Command Center", "Leads", "Projects", "Revenue"].map((title) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30">
              <div className="h-2 w-16 rounded-full bg-rapid-cyan/70" />
              <div className="mt-5 h-8 animate-pulse rounded-xl bg-white/10" />
              <p className="mt-4 text-sm font-semibold text-white">{title}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="login-curtain-panel absolute inset-0 grid place-items-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-rapid-blue to-rapid-cyan text-xl font-black text-white shadow-2xl shadow-blue-950/50">RR</div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.32em] text-rapid-cyan">Access granted</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Opening your dashboard</h2>
          <p className="mt-2 text-sm text-slate-400">Rapid Rise OS is preparing your command center.</p>
        </div>
      </div>
    </div>
  );
}
