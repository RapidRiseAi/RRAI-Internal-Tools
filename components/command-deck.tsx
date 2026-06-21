import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { labelize } from "@/lib/constants";
import { RadialRing } from "./deck-charts";

export type Tone = "cyan" | "copper" | "pos" | "neg" | "neutral";

/** Maps this app's real status / priority enum values to a command-deck colour tone. */
export function deckTone(value: string): Tone {
  const v = (value ?? "").toUpperCase();
  if (/(OVERDUE|BLOCKED|LOST|REJECTED|CANCELLED|FAILED|DISPUTED|SCRAPPED|EXPIRED|URGENT)/.test(v)) return "neg";
  if (/(PART_PAID|IN_PROGRESS|WAITING|REVIEW|FOLLOW|_DUE|NEGOTIAT|SENT|VIEWED|PENDING|TRIAL|UPGRADE|PLANNING|DESIGN|DEVELOPMENT|INTEGRATION|TESTING|REVISION|MAINTENANCE|SCHEDULED|CONTACTED|REPLIED|DISCOVERY|QUOTE|HIGH|MEDIUM)/.test(v)) return "copper";
  if (/(DONE|ACTIVE|WON|ACCEPTED|PAID|COMPLETED|LAUNCH|RESOLVED|CLOSED|APPROVED|PAYABLE|PUBLISHED)/.test(v)) return "pos";
  return "neutral";
}

const toneText: Record<Tone, string> = {
  cyan: "text-accent-cyan",
  copper: "text-accent-copper",
  pos: "text-pos",
  neg: "text-neg",
  neutral: "text-deck-muted",
};
const toneBadge: Record<Tone, string> = {
  cyan: "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan",
  copper: "border-accent-copper/30 bg-accent-copper/10 text-accent-copper",
  pos: "border-pos/30 bg-pos/10 text-pos",
  neg: "border-neg/30 bg-neg/10 text-neg",
  neutral: "border-hairline bg-white/[0.04] text-deck-muted",
};
const toneDot: Record<Tone, string> = {
  cyan: "bg-accent-cyan",
  copper: "bg-accent-copper",
  pos: "bg-pos",
  neg: "bg-neg",
  neutral: "bg-deck-muted",
};

/** Dark glass card: thin hairline border, soft cyan glow on hover (no drop shadow). */
export function DeckCard({ children, className, glow = true, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode; glow?: boolean }) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-hairline bg-deck-panel/80 p-5 backdrop-blur-sm transition duration-200",
        glow && "hover:border-accent-cyan/30 hover:shadow-[0_0_28px_-8px_rgba(70,232,209,0.35)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-deck-text">{title}</h2>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** Overflow "..." affordance — a real link to the fuller view when one exists. */
export function OverflowLink({ href, label = "More" }: { href: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="grid size-7 place-items-center rounded-md text-deck-muted transition hover:bg-white/[0.05] hover:text-deck-text">
      <MoreHorizontal className="size-4" />
    </Link>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return <span className={clsx("inline-block size-2 rounded-full", toneDot[tone], pulse && "deck-live-dot")} />;
}

export function DeckStatusBadge({ value, tone }: { value: string; tone?: Tone }) {
  const resolved = tone ?? deckTone(value);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", toneBadge[resolved])}>
      <span className={clsx("size-1.5 rounded-full", toneDot[resolved])} />
      {labelize(value)}
    </span>
  );
}

/** Monospace date label tinted by urgency (overdue = coral, soon = copper). */
export function DatePill({ date, tone = "neutral" }: { date: string; tone?: Tone }) {
  return <span className={clsx("font-mono text-xs font-semibold", toneText[tone])}>{date}</span>;
}

export function IconBadge({ icon: Icon, tone = "cyan", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span className={clsx("grid place-items-center rounded-lg border", toneBadge[tone], size === "md" ? "size-9" : "size-7")}>
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  );
}

/** Trend indicator. `direction` is the literal change; `good` controls colour
 * (so "expenses up" can be shown as a red up-arrow rather than misleading green). */
export function TrendPill({ direction, value, good }: { direction: "up" | "down"; value: string; good?: boolean }) {
  const isGood = good ?? direction === "up";
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-mono text-xs font-semibold", isGood ? "text-pos" : "text-neg")}>
      <span aria-hidden>{direction === "up" ? "▲" : "▼"}</span>
      {value}
    </span>
  );
}

/** KPI summary card: radial ring + headline number + "/ total" + optional trend. */
export function KpiCard({
  label,
  value,
  total,
  ringValue,
  trend,
  href,
}: {
  label: string;
  value: ReactNode;
  total?: ReactNode;
  ringValue: number;
  trend?: { direction: "up" | "down"; value: string; good?: boolean };
  href?: string;
}) {
  return (
    <DeckCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-deck-muted">{label}</p>
        {href ? <OverflowLink href={href} label={`Open ${label}`} /> : null}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <RadialRing value={ringValue} size={64} stroke={6}>
          <span className="font-mono text-[0.8rem] font-semibold text-deck-text">{Math.round(ringValue)}%</span>
        </RadialRing>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-bold leading-none text-deck-text">{value}</span>
            {total != null ? <span className="font-mono text-xs text-deck-muted">/ {total}</span> : null}
          </div>
          {trend ? <div className="mt-2"><TrendPill {...trend} /></div> : null}
        </div>
      </div>
    </DeckCard>
  );
}

export function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: "cyan" | "copper" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped}%`,
          background: tone === "cyan" ? "var(--deck-accent-cyan)" : "var(--deck-accent-copper)",
          boxShadow: tone === "cyan" ? "0 0 8px rgba(70,232,209,0.5)" : "0 0 8px rgba(232,154,77,0.5)",
        }}
      />
    </div>
  );
}

/** List panel: header (title + optional controls), rows, optional "View all ->" footer. */
export function ListPanel({ title, right, viewAllHref, viewAllLabel = "View all", children }: { title: string; right?: ReactNode; viewAllHref?: string; viewAllLabel?: string; children: ReactNode }) {
  return (
    <DeckCard className="flex flex-col p-0">
      <div className="border-b border-hairline px-5 py-4">
        <PanelHeader title={title} right={right} />
      </div>
      <div className="flex-1 divide-y divide-hairline">{children}</div>
      {viewAllHref ? (
        <Link href={viewAllHref} className="flex items-center justify-center gap-1 border-t border-hairline px-5 py-3 text-xs font-semibold text-accent-cyan transition hover:bg-white/[0.02]">
          {viewAllLabel} <ChevronRight className="size-3.5" />
        </Link>
      ) : null}
    </DeckCard>
  );
}

export function ListRow({ icon, iconTone = "cyan", title, subtitle, trailing, href }: { icon: LucideIcon; iconTone?: Tone; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; href?: string }) {
  const inner = (
    <>
      <IconBadge icon={icon} tone={iconTone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-deck-text">{title}</p>
        {subtitle != null ? <p className="truncate text-xs text-deck-muted">{subtitle}</p> : null}
      </div>
      {trailing != null ? <div className="shrink-0 text-right">{trailing}</div> : null}
    </>
  );
  const className = "flex items-center gap-3 px-5 py-3";
  return href ? (
    <Link href={href} className={clsx(className, "transition hover:bg-white/[0.02]")}>{inner}</Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-deck-muted">{children}</div>;
}

/** Narrowing funnel for genuinely staged data (e.g. the lead pipeline). */
export function Funnel({ stages }: { stages: { label: string; count: number; pct: number; conv: number | null }[] }) {
  const top = Math.max(...stages.map((stage) => stage.count), 1);
  return (
    <div className="grid gap-2">
      {stages.map((stage, index) => {
        const width = 36 + (stage.count / top) * 64; // never collapses fully, keeps the count legible
        return (
          <div key={stage.label} className="flex items-center gap-4">
            <div className="flex w-1/2 justify-center sm:w-[46%]">
              <div
                className="grid place-items-center rounded-md py-2 font-mono text-sm font-semibold text-deck-bg"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, var(--deck-accent-cyan), var(--deck-accent-copper))`,
                  opacity: 0.55 + (index / Math.max(stages.length - 1, 1)) * 0.45,
                }}
              >
                {stage.count.toLocaleString()}
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-deck-text">{stage.label}</p>
                <p className="font-mono text-xs text-deck-muted">{stage.count.toLocaleString()} ({stage.pct}%)</p>
              </div>
              {stage.conv != null ? (
                <span className="rounded-md border border-hairline bg-white/[0.03] px-2 py-1 font-mono text-xs text-accent-cyan">{stage.conv}%</span>
              ) : (
                <span className="font-mono text-xs text-deck-muted">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Per-day workload strip (HUD telemetry) — used by the personal panel timeline. */
export function WorkloadBars({ days }: { days: { label: string; sub: string; hoursLabel: string; fill: number; active?: boolean }[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => (
        <div key={`${day.label}-${day.sub}`} className={clsx("rounded-lg border px-2 py-3 text-center transition", day.active ? "border-accent-cyan/40 bg-accent-cyan/5" : "border-hairline bg-white/[0.02]")}>
          <p className="font-display text-[0.6rem] font-semibold uppercase tracking-wider text-deck-muted">{day.label}</p>
          <p className="text-sm font-semibold text-deck-text">{day.sub}</p>
          <p className="mt-2 font-mono text-xs text-accent-cyan">{day.hoursLabel}</p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-hairline">
            <div className="h-full rounded-full bg-accent-cyan" style={{ width: `${Math.max(0, Math.min(100, day.fill))}%`, boxShadow: "0 0 6px rgba(70,232,209,0.6)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
