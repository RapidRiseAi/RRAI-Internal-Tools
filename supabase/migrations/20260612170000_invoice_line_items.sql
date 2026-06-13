create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  unit_amount_cents integer not null default 0,
  sort_order integer not null default 0
);

alter table public.invoice_items enable row level security;
