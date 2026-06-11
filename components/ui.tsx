import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { labelize } from "@/lib/constants";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20", className)}>{children}</section>;
}

export function Button({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={clsx("rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:scale-[1.01]", className)} {...props}>{children}</button>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  return <Link href={href} className={clsx("rounded-xl px-4 py-2 text-sm font-semibold transition", variant === "primary" ? "bg-gradient-to-r from-rapid-blue to-rapid-cyan text-white shadow-lg shadow-blue-950/40" : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")}>{children}</Link>;
}

export function StatusBadge({ value }: { value: string }) {
  const palette = value.includes("OVERDUE") || value.includes("BLOCKED") || value.includes("LOST") || value.includes("REJECTED")
    ? "border-red-400/30 bg-red-400/10 text-red-200"
    : value.includes("DONE") || value.includes("ACTIVE") || value.includes("WON") || value.includes("ACCEPTED") || value.includes("PAID")
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : value.includes("WAITING") || value.includes("FOLLOW") || value.includes("DUE")
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-blue-400/30 bg-blue-400/10 text-blue-200";
  return <span className={clsx("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", palette)}>{labelize(value)}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-300"><span>{label}</span>{children}</label>;
}

export const inputClass = "w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none ring-rapid-blue/40 transition placeholder:text-slate-500 focus:border-rapid-blue focus:ring-2";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center"><h3 className="text-lg font-semibold text-white">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{body}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex items-start justify-between gap-4"><div>{eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.28em] text-rapid-cyan">{eyebrow}</p> : null}<h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{title}</h1>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}</div>{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}</div>;
}
