-- Allow tasks to control the Google Calendar event length.
alter table public.tasks
  add column if not exists duration_minutes integer not null default 60;

alter table public.tasks
  drop constraint if exists tasks_duration_minutes_check;

alter table public.tasks
  add constraint tasks_duration_minutes_check check (duration_minutes between 5 and 1440);
