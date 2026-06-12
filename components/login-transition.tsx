"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function LoginTransition() {
  const { pending } = useFormStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2f7dff55,transparent_34rem),radial-gradient(circle_at_80%_20%,#38d5ff33,transparent_28rem)]" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-6 pb-10 opacity-80">
        <div className="grid gap-4 md:grid-cols-4">
          {['Command Center', 'Leads', 'Projects', 'Revenue'].map((title) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30">
              <div className="h-2 w-16 rounded-full bg-rapid-cyan/70" />
              <div className="mt-5 h-8 rounded-xl bg-white/10" />
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
