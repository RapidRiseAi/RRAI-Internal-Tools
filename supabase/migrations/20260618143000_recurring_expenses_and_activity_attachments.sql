alter table public.expenses
  add column if not exists recurrence text not null default 'NONE' check (recurrence in ('NONE', 'MONTHLY')),
  add column if not exists next_due_date date;

create index if not exists expenses_recurrence_next_due_date_idx
  on public.expenses (recurrence, next_due_date)
  where recurrence <> 'NONE';
