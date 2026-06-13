-- Preserve time precision for operational scheduling fields.
-- Existing date-only values are promoted to midnight in the database time zone.
alter table public.tasks
  alter column due_date type timestamptz
  using due_date::timestamptz;

alter table public.leads
  alter column follow_up_date type timestamptz
  using follow_up_date::timestamptz;
