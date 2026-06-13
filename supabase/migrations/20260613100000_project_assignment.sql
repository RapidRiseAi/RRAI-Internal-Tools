alter table public.projects add column if not exists assigned_to uuid references public.users(id);
