alter table public.users
  add column if not exists employment_type text not null default 'FULL_TIME' check (employment_type in ('FULL_TIME','PART_TIME','CONTRACTOR','INTERN')),
  add column if not exists department text,
  add column if not exists specialties text,
  add column if not exists pay_type text not null default 'SALARY' check (pay_type in ('SALARY','HOURLY','CONTRACT')),
  add column if not exists pay_rate_cents integer not null default 0 check (pay_rate_cents >= 0),
  add column if not exists start_date date,
  add column if not exists emergency_contact text,
  add column if not exists employee_notes text;

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PAID','CANCELLED')),
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  user_id uuid not null references public.users(id),
  role_snapshot text,
  pay_type text not null check (pay_type in ('SALARY','HOURLY','CONTRACT')),
  hours numeric(10,2) not null default 0,
  gross_pay_cents integer not null check (gross_pay_cents >= 0),
  deductions_cents integer not null default 0 check (deductions_cents >= 0),
  net_pay_cents integer generated always as (gross_pay_cents - deductions_cents) stored,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
drop policy if exists payroll_runs_all on public.payroll_runs;
drop policy if exists payroll_items_all on public.payroll_items;
create policy payroll_runs_all on public.payroll_runs for all using (true) with check (true);
create policy payroll_items_all on public.payroll_items for all using (true) with check (true);

create trigger payroll_runs_updated_at before update on public.payroll_runs
for each row execute function public.set_updated_at();
