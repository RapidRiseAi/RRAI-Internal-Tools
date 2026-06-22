import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { labelize } from "@/lib/constants";

export function Card({ children, className, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={clsx("rounded-xl border border-hairline bg-deck-panel/80 p-5 backdrop-blur-sm transition duration-200 hover:border-accent-cyan/20", className)} {...props}>{children}</section>;
}

export function Button({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={clsx("rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-deck-bg transition duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60", className)} {...props}>{children}</button>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  return <Link href={href} className={clsx("rounded-lg px-4 py-2 text-sm font-semibold transition duration-150 active:scale-[0.98]", variant === "primary" ? "bg-accent-cyan text-deck-bg hover:brightness-110" : "border border-hairline bg-white/[0.03] text-deck-muted hover:text-deck-text")}>{children}</Link>;
}

function badgeTone(value: string): "pos" | "copper" | "neg" | "neutral" {
  const v = value.toUpperCase();
  if (/(OVERDUE|BLOCKED|LOST|REJECTED|CANCELLED|FAILED|DISPUTED|SCRAPPED|EXPIRED|URGENT)/.test(v)) return "neg";
  if (/(PART_PAID|IN_PROGRESS|WAITING|REVIEW|FOLLOW|_DUE|NEGOTIAT|SENT|VIEWED|PENDING|TRIAL|UPGRADE|PLANNING|DESIGN|DEVELOPMENT|INTEGRATION|TESTING|REVISION|MAINTENANCE|SCHEDULED|CONTACTED|REPLIED|DISCOVERY|QUOTE|HIGH|MEDIUM)/.test(v)) return "copper";
  if (/(DONE|ACTIVE|WON|ACCEPTED|PAID|COMPLETED|LAUNCH|RESOLVED|CLOSED|APPROVED|PAYABLE|PUBLISHED)/.test(v)) return "pos";
  return "neutral";
}

const badgeClasses: Record<ReturnType<typeof badgeTone>, string> = {
  pos: "border-pos/30 bg-pos/10 text-pos",
  copper: "border-accent-copper/30 bg-accent-copper/10 text-accent-copper",
  neg: "border-neg/30 bg-neg/10 text-neg",
  neutral: "border-hairline bg-white/[0.04] text-deck-muted",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClasses[badgeTone(value)])}>{labelize(value)}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-deck-muted"><span>{label}</span>{children}</label>;
}

export const inputClass = "w-full rounded-lg border border-hairline bg-deck-bg/60 px-3 py-2 text-sm text-deck-text outline-none transition placeholder:text-deck-muted focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/25";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-hairline bg-white/[0.02] p-10 text-center"><h3 className="font-display text-lg font-semibold text-deck-text">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-deck-muted">{body}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex items-start justify-between gap-4"><div>{eyebrow ? <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-accent-cyan">{eyebrow}</p> : null}<h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-deck-text">{title}</h1>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-deck-muted">{description}</p> : null}</div>{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}</div>;
}
