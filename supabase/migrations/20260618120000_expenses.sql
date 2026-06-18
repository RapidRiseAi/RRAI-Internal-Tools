create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  category text not null default 'GENERAL',
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'PENDING',
  expense_date date not null default current_date,
  notes text,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all using (true) with check (true);
