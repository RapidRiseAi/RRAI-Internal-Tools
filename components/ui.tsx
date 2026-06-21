import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { labelize } from "@/lib/constants";

export function Card({ children, className, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={clsx("rr-glass rr-glass-hover rounded-2xl p-5", className)} {...props}>{children}</section>;
}

export function Button({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={clsx("rr-action inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:scale-[1.015] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70", className)} {...props}>{children}</button>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  return <Link href={href} className={clsx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 active:scale-[0.98]", variant === "primary" ? "rr-action text-white hover:scale-[1.015]" : "border border-white/10 bg-white/[0.04] text-slate-200 hover:border-rapid-cyan/40 hover:bg-white/10 hover:text-white")}>{children}</Link>;
}

export function StatusBadge({ value }: { value: string }) {
  const palette = value.includes("OVERDUE") || value.includes("BLOCKED") || value.includes("LOST") || value.includes("REJECTED")
    ? "border-red-400/30 bg-red-400/10 text-red-200 shadow-[0_0_18px_-6px_rgba(248,113,113,0.7)]"
    : value.includes("DONE") || value.includes("ACTIVE") || value.includes("WON") || value.includes("ACCEPTED") || value.includes("PAID")
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 shadow-[0_0_18px_-6px_rgba(52,211,153,0.7)]"
      : value.includes("WAITING") || value.includes("FOLLOW") || value.includes("DUE")
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200 shadow-[0_0_18px_-6px_rgba(251,191,36,0.7)]"
        : "border-rapid-cyan/30 bg-rapid-cyan/10 text-rapid-cyan shadow-[0_0_18px_-6px_rgba(56,213,255,0.7)]";
  return <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", palette)}><span className="size-1.5 rounded-full bg-current opacity-80" />{labelize(value)}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-300"><span className="text-slate-300/90">{label}</span>{children}</label>;
}

export const inputClass = "w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/20 focus:border-rapid-cyan focus:bg-slate-950/80 focus:shadow-[0_0_0_3px_rgba(56,213,255,0.15)]";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rr-glass rr-brackets rounded-2xl p-10 text-center">
      <span className="rr-bracket tl" /><span className="rr-bracket tr" /><span className="rr-bracket bl" /><span className="rr-bracket br" />
      <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-rapid-cyan/30 bg-rapid-cyan/10 text-rapid-cyan shadow-[0_0_30px_-8px_rgba(56,213,255,0.6)]">
        <span className="rr-dot" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold text-rapid-cyan rr-hud">
            <span className="inline-block h-px w-6 bg-gradient-to-r from-transparent to-rapid-cyan" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white rr-neon-text">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
