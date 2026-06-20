-- Forward-only repair for databases where the original Google integration
-- migration was already marked as applied before all Calendar task columns were
-- added. Safe to run repeatedly and does not remove existing data.

alter table public.tasks
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_event_url text,
  add column if not exists google_calendar_synced_at timestamptz,
  add column if not exists google_calendar_user_id uuid references public.users(id) on delete set null;

create index if not exists tasks_google_calendar_event_id_idx
  on public.tasks(google_calendar_event_id)
  where google_calendar_event_id is not null;

create index if not exists tasks_google_calendar_user_id_idx
  on public.tasks(google_calendar_user_id)
  where google_calendar_user_id is not null;
