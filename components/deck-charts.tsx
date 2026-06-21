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
    <div className={clsx("relative grid place-items-center", className)} style={{ width: size, height: size }}>
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
 * Glowing multi-line chart. Y-axis tick labels are passed pre-formatted as strings
 * (no functions cross the server/client boundary); numeric values drive the geometry.
 */
export function LineChart({
  series,
  labels,
  yTicks,
  height = 240,
}: {
  series: Series[];
  labels: string[];
  yTicks: string[];
  height?: number;
}) {
  const filterId = useId();
  const fillId = useId();
  const width = 100;
  const padTop = 8;
  const padBottom = 16;
  const chartHeight = height - padTop - padBottom;
  const allValues = series.flatMap((line) => line.values);
  const max = Math.max(1, ...allValues);
  const count = Math.max(...series.map((line) => line.values.length), 1);

  const xFor = (index: number) => (count <= 1 ? 0 : (index / (count - 1)) * width);
  const yFor = (value: number) => padTop + chartHeight - (value / max) * chartHeight;
  const color = (tone: Series["tone"]) => (tone === "cyan" ? "var(--deck-accent-cyan)" : "var(--deck-accent-copper)");

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between py-1 text-right font-mono text-[0.65rem] text-deck-muted" style={{ height }}>
        {yTicks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{tick}</span>
        ))}
      </div>
      <div className="flex-1">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--deck-accent-cyan)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--deck-accent-cyan)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((_, index) => {
            const y = padTop + (chartHeight / Math.max(yTicks.length - 1, 1)) * index;
            return <line key={index} x1="0" y1={y} x2={width} y2={y} stroke="var(--deck-hairline)" strokeWidth="0.4" />;
          })}
          {series.map((line, lineIndex) => {
            const points = line.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
            const area = `0,${padTop + chartHeight} ${points} ${xFor(line.values.length - 1)},${padTop + chartHeight}`;
            return (
              <g key={line.name}>
                {lineIndex === 0 ? <polygon points={area} fill={`url(#${fillId})`} /> : null}
                <polyline
                  points={points}
                  fill="none"
                  stroke={color(line.tone)}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  filter={`url(#${filterId})`}
                />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-deck-muted">
          {labels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
