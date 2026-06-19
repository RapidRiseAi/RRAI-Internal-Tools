create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  contact_name text,
  email text,
  phone text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors enable row level security;
drop policy if exists vendors_all on public.vendors;
create policy vendors_all on public.vendors for all using (true) with check (true);

alter table public.expenses drop constraint if exists expenses_recurrence_check;
alter table public.expenses
  add constraint expenses_recurrence_check check (recurrence in ('NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'));

create trigger vendors_updated_at before update on public.vendors
for each row execute function public.set_updated_at();
