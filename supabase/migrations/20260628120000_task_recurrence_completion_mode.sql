-- Let recurring tasks either prefill future calendar occurrences or require completion first.
alter table public.tasks
  add column if not exists recurrence_completion_required boolean not null default false;

create index if not exists tasks_recurrence_parent_due_date_idx
  on public.tasks (recurrence_parent_task_id, due_date)
  where recurrence_parent_task_id is not null;
