begin;

-- Security hardening: these SECURITY DEFINER functions were executable by the
-- `anon` and `authenticated` roles via the public REST API
-- (/rest/v1/rpc/<name>), meaning an unauthenticated caller could invoke
-- privileged CRM mutations. They are only ever called server-side with the
-- service-role key (see lib/actions.ts: getSupabaseAdmin().rpc(...)), so no
-- client needs execute. Flagged by the Supabase security advisor
-- (lint 0028/0029). Revoke from anon + authenticated; keep service_role.

revoke execute on function public.accept_quote_atomic(uuid, uuid, text)
  from anon, authenticated;
revoke execute on function public.convert_lead_to_client_atomic(uuid, uuid)
  from anon, authenticated;
revoke execute on function public.rls_auto_enable()
  from anon, authenticated;

grant execute on function public.accept_quote_atomic(uuid, uuid, text)
  to service_role;
grant execute on function public.convert_lead_to_client_atomic(uuid, uuid)
  to service_role;
grant execute on function public.rls_auto_enable()
  to service_role;

commit;
