-- Prevent accidental duplicate writes from double-clicks, retries, and slow network resubmissions.
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  submission_key text not null,
  action text not null,
  created_at timestamptz not null default now(),
  unique (submission_key)
);

create index if not exists form_submissions_user_created_at_idx on public.form_submissions(user_id, created_at desc);

alter table public.form_submissions enable row level security;
