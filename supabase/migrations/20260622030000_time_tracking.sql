-- Time tracking: clock in/out entries per user, optionally tied to a task /
-- project / client. Service-role access like the rest of the app; RLS enabled
-- with no policies. Also adds billable hours/rate fields to services (products).

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  task_id uuid references public.tasks(id),
  project_id uuid references public.projects(id),
  client_id uuid references public.clients(id),
  description text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_billable boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_user_started_idx on public.time_entries(user_id, started_at desc);
create index if not exists time_entries_task_idx on public.time_entries(task_id);

alter table public.time_entries enable row level security;

-- Hours / billable rate on services (products) for estimates.
alter table public.services
  add column if not exists hourly_rate_cents integer not null default 0,
  add column if not exists estimated_hours numeric not null default 0;
