-- Forward-only repair for environments that received recurring-task code before all
-- recurring task migrations were applied. Keeps Google Calendar sync from failing
-- while preparing automatic recurring task occurrences.
alter table public.tasks
  add column if not exists recurrence text not null default 'NONE',
  add column if not exists recurrence_interval integer not null default 1,
  add column if not exists recurrence_day_of_week integer,
  add column if not exists recurrence_day_of_month integer,
  add column if not exists recurrence_next_due_at timestamptz,
  add column if not exists recurrence_parent_task_id uuid references public.tasks(id),
  add column if not exists recurrence_completion_required boolean not null default false;

alter table public.tasks drop constraint if exists tasks_recurrence_check;
alter table public.tasks
  add constraint tasks_recurrence_check check (recurrence in ('NONE', 'WEEKLY', 'MONTHLY'));

alter table public.tasks drop constraint if exists tasks_recurrence_interval_check;
alter table public.tasks
  add constraint tasks_recurrence_interval_check check (recurrence_interval between 1 and 52);

alter table public.tasks drop constraint if exists tasks_recurrence_day_of_week_check;
alter table public.tasks
  add constraint tasks_recurrence_day_of_week_check check (recurrence_day_of_week is null or recurrence_day_of_week between 0 and 6);

alter table public.tasks drop constraint if exists tasks_recurrence_day_of_month_check;
alter table public.tasks
  add constraint tasks_recurrence_day_of_month_check check (recurrence_day_of_month is null or recurrence_day_of_month between 1 and 31);

create index if not exists tasks_recurrence_next_due_idx
  on public.tasks (recurrence, recurrence_next_due_at)
  where recurrence <> 'NONE';

create index if not exists tasks_recurrence_parent_due_date_idx
  on public.tasks (recurrence_parent_task_id, due_date)
  where recurrence_parent_task_id is not null;
