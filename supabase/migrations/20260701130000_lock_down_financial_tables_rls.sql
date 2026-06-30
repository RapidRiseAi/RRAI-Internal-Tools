begin;

-- CRITICAL SECURITY FIX (applied 2026-07-01 via MCP; this file is the record).
--
-- public.expenses / payroll_items / payroll_runs / vendors each had an
-- `ALL` RLS policy with USING(true)/WITH CHECK(true) for role `public`, PLUS full
-- table grants to anon + authenticated. Because the anon key is public (it ships
-- in the affiliate portal + website browser bundles), anyone on the internet
-- could read, modify, or delete company payroll, expenses, and vendor data via
-- the Supabase REST API.
--
-- Fix: drop the always-true policies and revoke all anon/authenticated grants.
-- RLS stays enabled with no policy => deny-all for anon/authenticated. The
-- internal CRM app uses the service role (bypasses RLS) and is unaffected.

drop policy if exists expenses_all on public.expenses;
drop policy if exists payroll_items_all on public.payroll_items;
drop policy if exists payroll_runs_all on public.payroll_runs;
drop policy if exists vendors_all on public.vendors;

revoke all on public.expenses from anon, authenticated;
revoke all on public.payroll_items from anon, authenticated;
revoke all on public.payroll_runs from anon, authenticated;
revoke all on public.vendors from anon, authenticated;

commit;
