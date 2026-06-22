-- Goals / targets: org-level targets (revenue, leads, projects, etc.) that the
-- business panel renders as "current vs target" progress rings. Service-role
-- access like the rest of the app; RLS enabled with no policies.

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  metric text not null,
  label text,
  target_value numeric not null default 0,
  period text not null default 'MONTHLY',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_metric_idx on public.goals(metric);

alter table public.goals enable row level security;
