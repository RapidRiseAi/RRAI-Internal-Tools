// Pure presentation-layer aggregation helpers for the command-deck views.
// No database, no business logic — just math over data the pages already fetch.

import { labelize } from "./constants";

/** Counts items by a key and returns labelised {label,value} sorted desc — for bar/donut charts. */
export function distribution<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label: labelize(label), value })).sort((a, b) => b.value - a.value);
}

export function compactMoney(cents: number) {
  const rand = (cents ?? 0) / 100;
  const sign = rand < 0 ? "-" : "";
  const abs = Math.abs(rand);
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}R${Math.round(abs / 1_000)}K`;
  return `${sign}R${Math.round(abs)}`;
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function startOfWeekMonday(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - ((day + 6) % 7));
  return copy;
}

export function lastNWeekStarts(weeks: number, now = new Date()) {
  const monday = startOfWeekMonday(now);
  const out: Date[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const day = new Date(monday);
    day.setDate(monday.getDate() - i * 7);
    out.push(day);
  }
  return out;
}

export function weeklyTotals<T>(items: T[], getDate: (item: T) => string | null | undefined, getCents: (item: T) => number, weekStarts: Date[]) {
  return weekStarts.map((start) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    let total = 0;
    for (const item of items) {
      const value = getDate(item);
      if (!value) continue;
      const time = new Date(value).getTime();
      if (time >= start.getTime() && time < end.getTime()) total += getCents(item);
    }
    return total;
  });
}

export function isInMonthOffset(dateStr: string | null | undefined, offset: number, now = new Date()) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
}

export function monthDayShort(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

/** Builds a trend descriptor from a current vs previous value, or null when there's
 * no honest basis for a delta (e.g. no prior-period data to compare against). */
export function deltaTrend(current: number, previous: number, upIsGood = true): { direction: "up" | "down"; value: string; good: boolean } | null {
  if (!previous) return null;
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (change === 0) return null;
  const direction = change > 0 ? "up" : "down";
  return { direction, value: `${Math.abs(change)}%`, good: upIsGood ? change > 0 : change < 0 };
}
