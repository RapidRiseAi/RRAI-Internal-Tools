begin;

-- Hot-path indexes for the affiliate portal + commission automation.
--
-- Postgres does NOT auto-create indexes on foreign keys, and the core CRM
-- tables (commissions, referrals, quotes) were filtered/joined by these columns
-- on every affiliate portal page load and inside the payment->commission
-- trigger. Without these, each lookup is a sequential scan that degrades as the
-- tables grow. Every index here backs a query that already exists in code:
--
--   * commissions.affiliate_id   -> portal dashboard + commission statement
--   * referrals.affiliate_id     -> portal dashboard + referral pipeline
--   * referrals.lead_id/client_id-> create_commissions_for_paid_payment() match,
--                                   plus the "lead already has a referral" guard
--   * quotes.lead_id/client_id   -> commission automation quote lookup
--   * quote_items.quote_id       -> per-line commission calculation loop
--   * activity_logs.lead_id      -> portal "latest safe progress note"
--
-- All are additive and reversible (drop index ...). Safe to run on the live DB;
-- at the current row counts these build in milliseconds. For very large tables
-- in future, prefer `create index concurrently` run OUTSIDE a transaction.

create index if not exists commissions_affiliate_status_idx
  on public.commissions (affiliate_id, status);
create index if not exists commissions_quote_id_idx
  on public.commissions (quote_id);
create index if not exists commissions_payment_id_idx
  on public.commissions (payment_id);
create index if not exists commissions_project_id_idx
  on public.commissions (project_id);

create index if not exists referrals_affiliate_id_idx
  on public.referrals (affiliate_id);
create index if not exists referrals_lead_id_idx
  on public.referrals (lead_id);
create index if not exists referrals_client_id_idx
  on public.referrals (client_id);

create index if not exists quotes_lead_id_idx
  on public.quotes (lead_id);
create index if not exists quotes_client_id_idx
  on public.quotes (client_id);

create index if not exists quote_items_quote_id_idx
  on public.quote_items (quote_id);

create index if not exists activity_logs_lead_id_idx
  on public.activity_logs (lead_id);

commit;
