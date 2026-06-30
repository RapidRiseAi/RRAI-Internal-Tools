begin;

-- Least-privilege hardening (applied 2026-07-01 via MCP; this file is the record).
--
-- The base CRM tables carried broad INSERT/UPDATE/DELETE/TRUNCATE/SELECT grants to
-- anon + authenticated. Row access was mostly blocked by RLS-with-no-policy, but
-- that is fragile (a single added permissive policy reopens it — which is exactly
-- how expenses/payroll/vendors became world-open) and TRUNCATE ignores RLS.
--
-- The internal CRM app uses the service role, and the affiliate portal only
-- touches affiliate_portal_* tables as the authenticated user, so anon/
-- authenticated need nothing on the base tables. Revoke everything from them on
-- every public table EXCEPT affiliate_portal_* (which keep their RLS-enforced
-- grants). service_role is untouched.

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not like 'affiliate_portal_%'
  loop
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

commit;
