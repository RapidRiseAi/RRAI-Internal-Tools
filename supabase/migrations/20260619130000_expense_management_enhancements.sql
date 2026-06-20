alter table public.expenses
  add column if not exists expense_type text not null default 'GENERAL';

update public.expenses
set expense_type = case
  when lower(category) like '%subscription%' then 'SUBSCRIPTION'
  when lower(category) like '%payroll%' or lower(category) like '%salary%' then 'PAYROLL'
  when lower(category) like '%software%' then 'SOFTWARE'
  else 'GENERAL'
end
where expense_type is null or expense_type = 'GENERAL';

create index if not exists expenses_expense_type_idx on public.expenses (expense_type);
