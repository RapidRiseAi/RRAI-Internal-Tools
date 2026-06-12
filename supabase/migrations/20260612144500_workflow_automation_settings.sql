-- Workflow automation additions for quote-based invoices, company billing settings and document templates.
alter table public.invoices add column if not exists quote_id uuid references public.quotes(id);

create table if not exists public.company_settings (
  id boolean primary key default true,
  company_name text not null default 'Rapid Rise AI (Pty) Ltd',
  billing_email text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch_code text,
  payment_terms text,
  quote_footer text,
  invoice_footer text,
  updated_at timestamptz not null default now(),
  constraint company_settings_singleton check (id)
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('QUOTE','INVOICE','PROPOSAL','HANDOVER')),
  content text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;
alter table public.document_templates enable row level security;

insert into public.company_settings (id, company_name, payment_terms, quote_footer, invoice_footer)
values (true, 'Rapid Rise AI (Pty) Ltd', 'Deposit due on acceptance. Balance due before launch unless otherwise agreed.', 'Thank you for considering Rapid Rise AI.', 'Thank you for your business.')
on conflict (id) do nothing;

insert into public.document_templates (name, type, content, is_default)
values
('Default Quote Template', 'QUOTE', 'Rapid Rise AI quote for {{client_name}}. Scope: {{quote_title}}. Once-off: {{once_off_total}}. Monthly: {{monthly_total}}.', true),
('Default Invoice Template', 'INVOICE', 'Invoice {{invoice_number}} for {{client_name}}. Amount due: {{amount}}. Due date: {{due_date}}.', true)
on conflict do nothing;
