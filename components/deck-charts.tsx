"use client";

import { useId } from "react";
import { clsx } from "clsx";

/**
 * Circular radial progress ring with a copper -> cyan gradient stroke.
 * Reused at any size wherever there's a percentage or "X of Y" value.
 */
export function RadialRing({
  value,
  size = 72,
  stroke = 7,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const gradientId = useId();

  return (
    <div className={clsx("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--deck-accent-copper)" />
            <stop offset="100%" stopColor="var(--deck-accent-cyan)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--deck-hairline)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ filter: "drop-shadow(0 0 4px rgba(70, 232, 209, 0.35))" }}
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center">{children}</div> : null}
    </div>
  );
}

type Series = { name: string; values: number[]; tone: "cyan" | "copper" };

/**
 * Glowing multi-line chart that fills its container height (for one-screen layouts).
 * Geometry is normalised to a 0–100 viewBox and stretched with preserveAspectRatio="none";
 * strokes stay crisp via vectorEffect and a CSS drop-shadow glow. Y tick labels are passed
 * pre-formatted as strings so no functions cross the server/client boundary.
 */
export function LineChart({ series, labels, yTicks }: { series: Series[]; labels: string[]; yTicks: string[] }) {
  const fillId = useId();
  const max = Math.max(1, ...series.flatMap((line) => line.values));
  const count = Math.max(...series.map((line) => line.values.length), 1);
  const xFor = (index: number) => (count <= 1 ? 0 : (index / (count - 1)) * 100);
  const yFor = (value: number) => 100 - (value / max) * 100;
  const color = (tone: Series["tone"]) => (tone === "cyan" ? "var(--deck-accent-cyan)" : "var(--deck-accent-copper)");
  const glow = (tone: Series["tone"]) => (tone === "cyan" ? "drop-shadow(0 0 3px rgba(70,232,209,0.6))" : "drop-shadow(0 0 3px rgba(232,154,77,0.55))");

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[0.6rem] text-deck-muted">
        {yTicks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{tick}</span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="min-h-0 w-full flex-1">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--deck-accent-cyan)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--deck-accent-cyan)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((_, index) => {
            const y = (100 / Math.max(yTicks.length - 1, 1)) * index;
            return <line key={index} x1="0" y1={y} x2="100" y2={y} stroke="var(--deck-hairline)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />;
          })}
          {series.map((line, lineIndex) => {
            const points = line.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
            const area = `0,100 ${points} ${xFor(line.values.length - 1)},100`;
            return (
              <g key={line.name}>
                {lineIndex === 0 ? <polygon points={area} fill={`url(#${fillId})`} /> : null}
                <polyline
                  points={points}
                  fill="none"
                  stroke={color(line.tone)}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: glow(line.tone) }}
                />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex shrink-0 justify-between font-mono text-[0.6rem] text-deck-muted">
          {labels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
