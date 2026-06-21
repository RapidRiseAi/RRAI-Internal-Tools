"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

export function ModalPanel({ title, triggerLabel, children, variant = "primary" }: { title: string; triggerLabel: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()} className={clsx("inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition", variant === "primary" ? "rr-action text-white hover:scale-[1.015]" : "border border-white/10 bg-white/5 text-slate-200 hover:border-rapid-cyan/40 hover:bg-white/10 hover:text-white")}>{triggerLabel}</button>
    <dialog ref={dialogRef} className="fixed inset-0 m-auto w-[min(96vw,1100px)] max-h-[92vh] rounded-3xl border border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 backdrop:bg-slate-950/75">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/10" aria-label="Close modal"><X className="size-4" /></button>
      </div>
      <div className="max-h-[82vh] overflow-auto p-6">{children}</div>
    </dialog>
  </>;
}
