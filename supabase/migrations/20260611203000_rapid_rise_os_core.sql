-- Rapid Rise OS production database for Supabase.
-- This migration is intended to run in the connected Supabase project before/with Vercel deployment.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role_id uuid not null references public.roles(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  title text,
  phone text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text,
  phone text,
  source text not null,
  service_interest text not null,
  stage text not null default 'NEW_LEAD' check (stage in ('NEW_LEAD','CONTACTED','REPLIED','DISCOVERY_NEEDED','DISCOVERY_COMPLETED','QUOTE_NEEDED','QUOTE_SENT','NEGOTIATING','WON','LOST','FOLLOW_UP_LATER')),
  score integer not null default 50 check (score between 0 and 100),
  follow_up_date date,
  next_action text,
  pain_points text,
  lost_reason text,
  assigned_to uuid references public.users(id),
  created_by uuid references public.users(id),
  converted_client_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  industry text,
  website text,
  primary_email text,
  primary_phone text,
  next_action text,
  mrr_cents integer not null default 0 check (mrr_cents >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads add constraint leads_converted_client_id_fkey foreign key (converted_client_id) references public.clients(id);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  description text not null,
  base_once_off_cents integer not null default 0,
  base_monthly_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  name text not null,
  description text not null,
  once_off_cents integer not null default 0,
  monthly_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  lead_id uuid references public.leads(id),
  client_id uuid references public.clients(id),
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','VIEWED','FOLLOW_UP_DUE','ACCEPTED','REJECTED','EXPIRED')),
  title text not null,
  once_off_total_cents integer not null default 0,
  monthly_total_cents integer not null default 0,
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  service_id uuid references public.services(id),
  description text not null,
  quantity integer not null default 1,
  once_off_cents integer not null default 0,
  monthly_cents integer not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  quote_id uuid references public.quotes(id),
  name text not null,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','WAITING_FOR_CLIENT_INFO','PLANNING','DESIGN','DEVELOPMENT','INTEGRATION','TESTING','CLIENT_REVIEW','REVISIONS','READY_TO_LAUNCH','LAUNCHED','MAINTENANCE','COMPLETED')),
  stage text,
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  deadline date,
  progress integer not null default 0 check (progress between 0 and 100),
  blocker text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null default 'ADMIN_TASK',
  status text not null default 'TO_DO' check (status in ('TO_DO','IN_PROGRESS','WAITING_FOR_CLIENT','WAITING_INTERNALLY','BLOCKED','REVIEW_NEEDED','DONE')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  due_date date,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  assigned_to uuid references public.users(id),
  created_by uuid references public.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_templates (id uuid primary key default gen_random_uuid(), name text not null, service_id uuid references public.services(id), description text, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.checklist_items (id uuid primary key default gen_random_uuid(), template_id uuid not null references public.checklist_templates(id) on delete cascade, title text not null, description text, sort_order integer not null default 0);
create table if not exists public.project_checklists (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, template_item_id uuid references public.checklist_items(id), title text not null, status text not null default 'TO_DO', completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.notes (id uuid primary key default gen_random_uuid(), body text not null, entity_type text not null, entity_id uuid not null, client_id uuid references public.clients(id), lead_id uuid references public.leads(id), project_id uuid references public.projects(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.files (id uuid primary key default gen_random_uuid(), filename text not null, url text not null, mime_type text, entity_type text not null, entity_id uuid not null, client_id uuid references public.clients(id), project_id uuid references public.projects(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.invoices (id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id), invoice_number text not null unique, status text not null default 'DRAFT', amount_cents integer not null, due_date date, issued_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.payments (id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id), amount_cents integer not null, status text not null default 'PENDING', paid_at timestamptz, method text, reference text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.retainers (id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id), type text not null, status text not null default 'ACTIVE', monthly_amount_cents integer not null, next_billing_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.support_tickets (id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id), project_id uuid references public.projects(id), title text not null, category text not null, priority text not null default 'MEDIUM', status text not null default 'NEW', assigned_to uuid references public.users(id), internal_notes text, client_update_notes text, resolution_notes text, resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.affiliates (id uuid primary key default gen_random_uuid(), name text not null, email text not null unique, tracking_code text not null unique, status text not null default 'ACTIVE', default_commission_type text not null default 'ONCE_OFF', default_commission_rate integer not null default 10, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.referrals (id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.affiliates(id), lead_id uuid references public.leads(id), client_id uuid references public.clients(id), status text not null default 'PENDING', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.commissions (id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.affiliates(id), quote_id uuid references public.quotes(id), project_id uuid references public.projects(id), payment_id uuid references public.payments(id), status text not null default 'PENDING', amount_cents integer not null, commission_type text not null default 'ONCE_OFF', paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.campaigns (id uuid primary key default gen_random_uuid(), name text not null, platform text not null, target_industry text, offer_message text, number_contacted integer not null default 0, replies integer not null default 0, calls_booked integer not null default 0, quotes_sent integer not null default 0, deals_closed integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.content_items (id uuid primary key default gen_random_uuid(), title text not null, status text not null default 'IDEA', platform text, post_url text, performance_notes text, leads_generated integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.knowledge_base_items (id uuid primary key default gen_random_uuid(), title text not null, category text not null, body text not null, visibility text not null default 'INTERNAL', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.activity_logs (id uuid primary key default gen_random_uuid(), action text not null, entity_type text not null, entity_id uuid not null, message text not null, actor_id uuid references public.users(id), lead_id uuid references public.leads(id), client_id uuid references public.clients(id), quote_id uuid references public.quotes(id), project_id uuid references public.projects(id), task_id uuid references public.tasks(id), created_at timestamptz not null default now());
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), title text not null, body text not null, user_id uuid references public.users(id), status text not null default 'UNREAD', created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create index if not exists leads_stage_idx on public.leads(stage);
create index if not exists leads_follow_up_idx on public.leads(follow_up_date);
create index if not exists clients_status_idx on public.clients(account_status);
create index if not exists tasks_status_due_idx on public.tasks(status, due_date);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.services enable row level security;
alter table public.packages enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.project_checklists enable row level security;
alter table public.notes enable row level security;
alter table public.files enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.retainers enable row level security;
alter table public.support_tickets enable row level security;
alter table public.affiliates enable row level security;
alter table public.referrals enable row level security;
alter table public.commissions enable row level security;
alter table public.campaigns enable row level security;
alter table public.content_items enable row level security;
alter table public.knowledge_base_items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

insert into public.roles (name, description, permissions) values
('Owner/Admin', 'Full system owner access.', '["dashboard:view","leads:read","leads:write","clients:read","clients:write","quotes:read","quotes:write","projects:read","projects:write","tasks:read","tasks:write","billing:read","billing:write","support:read","support:write","marketing:read","marketing:write","settings:manage"]'),
('Manager', 'Operational management access.', '["dashboard:view","leads:read","leads:write","clients:read","clients:write","quotes:read","quotes:write","projects:read","projects:write","tasks:read","tasks:write","billing:read","billing:write","support:read","support:write","marketing:read","marketing:write"]'),
('Sales', 'Sales CRM and quotes access.', '["dashboard:view","leads:read","leads:write","clients:read","quotes:read","quotes:write","tasks:read","tasks:write","marketing:read"]'),
('Project Manager', 'Delivery management access.', '["dashboard:view","clients:read","quotes:read","projects:read","projects:write","tasks:read","tasks:write","support:read"]'),
('Developer/Designer', 'Assigned delivery access.', '["dashboard:view","clients:read","projects:read","tasks:read","tasks:write","support:read"]'),
('Support', 'Support desk access.', '["dashboard:view","clients:read","projects:read","tasks:read","tasks:write","support:read","support:write"]'),
('Finance', 'Finance and billing access.', '["dashboard:view","clients:read","quotes:read","billing:read","billing:write"]'),
('Affiliate/Partner', 'Partner dashboard access.', '["dashboard:view"]'),
('Read-only', 'Read only internal visibility.', '["dashboard:view","leads:read","clients:read","quotes:read","projects:read","tasks:read","billing:read","support:read","marketing:read"]')
on conflict (name) do update set description = excluded.description, permissions = excluded.permissions, updated_at = now();

insert into public.users (name, email, password_hash, role_id, title)
select 'Xander Blumenthal', coalesce(nullif(current_setting('app.seed_owner_email', true), ''), 'owner@rapidrise.ai'), crypt(coalesce(nullif(current_setting('app.seed_owner_password', true), ''), 'ChangeMe123!'), gen_salt('bf')), roles.id, 'Founder / Owner'
from public.roles where roles.name = 'Owner/Admin'
on conflict (email) do nothing;

insert into public.services (name, category, description, base_once_off_cents, base_monthly_cents) values
('Website development','Web','Rapid Rise AI website development delivery service with quote, project and checklist support.',150000,0),
('Website hosting and maintenance','Web','Hosting and maintenance retainer service.',175000,15000),
('SEO','Marketing','Search optimization service.',200000,25000),
('AI ranking / AI search visibility','AI & Automation','AI search visibility optimization service.',225000,25000),
('Client portals','Software','Private client portal builds.',250000,15000),
('Custom dashboards','Software','Custom reporting and operations dashboards.',275000,15000),
('AI communication/support agents','AI & Automation','AI support and communication agent systems.',300000,20000),
('WhatsApp AI systems','AI & Automation','WhatsApp-based AI automation systems.',325000,20000),
('Workflow automations','AI & Automation','Workflow automation service.',350000,10000),
('Custom software','Software','Custom software development service.',375000,0),
('Internal business systems','Software','Internal business OS and operations systems.',400000,15000),
('Integrations','Software','System integration service.',425000,0),
('Landing pages','Web','High-conversion landing page builds.',450000,0),
('QR menu systems','Software','QR menu system builds.',475000,10000),
('Inspection systems','Software','Inspection and field workflow systems.',500000,15000),
('Booking systems','Software','Booking system builds.',525000,10000),
('Reporting systems','Software','Reporting system builds.',550000,15000)
on conflict (name) do nothing;

insert into public.leads (company_name, contact_name, email, source, service_interest, stage, score, follow_up_date, next_action, pain_points)
values ('Rapid Rise Demo Prospect', 'Demo Decision Maker', 'prospect@example.com', 'Referral', 'Internal business systems', 'DISCOVERY_NEEDED', 82, current_date, 'Book discovery call and confirm service scope.', 'Needs one place for leads, projects, retainers and support.')
on conflict do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles','users','leads','clients','contacts','services','packages','quotes','projects','tasks','checklist_templates','project_checklists','notes','files','invoices','payments','retainers','support_tickets','affiliates','referrals','commissions','campaigns','content_items','knowledge_base_items','notifications'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;
