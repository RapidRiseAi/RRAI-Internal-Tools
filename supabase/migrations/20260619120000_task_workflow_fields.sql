alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check check (status in ('TO_DO','IN_PROGRESS','WAITING_FOR_CLIENT','WAITING_INTERNALLY','BLOCKED','REVIEW_NEEDED','DONE','SCRAPPED'));
