begin;

-- Affiliate-provided payout / banking details (P1). Writes go through a
-- service-role API route after an ownership check; the owning affiliate and CRM
-- admins can read. No anon/authenticated write grants (sensitive data).

create table public.affiliate_portal_payout_methods (
  affiliate_id uuid primary key references public.affiliates(id) on delete cascade,
  account_holder text not null check (char_length(btrim(account_holder)) between 2 and 200),
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 120),
  account_number text not null check (account_number ~ '^[0-9 -]{4,34}$'),
  branch_code text not null check (branch_code ~ '^[0-9A-Za-z -]{3,20}$'),
  tax_number text check (tax_number is null or char_length(btrim(tax_number)) between 2 and 50),
  paypal_email text check (paypal_email is null or paypal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_by_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.affiliate_portal_payout_methods is
  'Affiliate-provided payout/banking details. Writes go through a service-role API after an ownership check; readable by the owning affiliate and CRM admins.';

alter table public.affiliate_portal_payout_methods enable row level security;

create trigger affiliate_portal_payout_methods_set_updated_at
before update on public.affiliate_portal_payout_methods
for each row execute function affiliate_portal_private.set_updated_at();

revoke all on table public.affiliate_portal_payout_methods from anon, authenticated;
grant all on table public.affiliate_portal_payout_methods to service_role;
grant select on table public.affiliate_portal_payout_methods to authenticated;

create policy affiliate_portal_payout_methods_select_authorized
on public.affiliate_portal_payout_methods
for select to authenticated
using (
  (select affiliate_portal_private.owns_affiliate(affiliate_id))
  or (select affiliate_portal_private.is_crm_admin())
);

commit;
