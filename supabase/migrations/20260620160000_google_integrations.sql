-- Google account, Drive and Calendar integration foundation.

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  google_sub text not null unique,
  google_email text not null,
  google_name text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  calendar_connected boolean not null default false,
  drive_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_event_url text,
  add column if not exists google_calendar_synced_at timestamptz;

create index if not exists google_connections_user_id_idx on public.google_connections(user_id);
create index if not exists tasks_google_calendar_event_id_idx on public.tasks(google_calendar_event_id) where google_calendar_event_id is not null;

alter table public.google_connections enable row level security;

drop trigger if exists set_google_connections_updated_at on public.google_connections;
create trigger set_google_connections_updated_at before update on public.google_connections for each row execute function public.set_updated_at();
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS google_calendar_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_google_calendar_user_id_idx
  ON public.tasks(google_calendar_user_id)
  WHERE google_calendar_user_id IS NOT NULL;
