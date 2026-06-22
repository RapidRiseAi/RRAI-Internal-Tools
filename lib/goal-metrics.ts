// Goal metric registry. Each metric maps to a value the business panel already
// computes from existing data, so a goal is just "current vs target".

export type GoalMetricKind = "money" | "count";

export const goalMetrics: { key: string; label: string; kind: GoalMetricKind }[] = [
  { key: "REVENUE_MONTH", label: "Revenue (this month)", kind: "money" },
  { key: "NEW_LEADS_MONTH", label: "New leads (this month)", kind: "count" },
  { key: "TASKS_DONE_MONTH", label: "Tasks completed (this month)", kind: "count" },
  { key: "ACTIVE_PROJECTS", label: "Active projects", kind: "count" },
  { key: "PIPELINE_VALUE", label: "Open pipeline value", kind: "money" },
  { key: "MRR", label: "Monthly recurring revenue", kind: "money" },
];

export const goalMetricMap: Record<string, { key: string; label: string; kind: GoalMetricKind }> = Object.fromEntries(goalMetrics.map((metric) => [metric.key, metric]));
