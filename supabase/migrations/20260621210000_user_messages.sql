-- User-to-user messaging: direct messages between users plus team broadcasts.
-- Access is enforced in server actions via the service-role key (same model as the
-- rest of the app); RLS is enabled with no policies so the anon key gets nothing.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id),
  recipient_id uuid references public.users(id),
  audience text not null default 'DIRECT',
  broadcast_role text,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_recipient_unread_idx on public.messages(recipient_id, read_at);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create index if not exists messages_audience_idx on public.messages(audience);

alter table public.messages enable row level security;
