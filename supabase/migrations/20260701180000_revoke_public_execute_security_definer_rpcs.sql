begin;

-- Follow-up to 20260629123000: that migration revoked EXECUTE from anon +
-- authenticated, but Postgres grants function EXECUTE to the PUBLIC pseudo-role
-- by default, and anon/authenticated inherit PUBLIC. So the functions were still
-- callable via the REST API (confirmed by the security advisor). Revoke from
-- PUBLIC so only service_role (server-side) can call them.

revoke execute on function public.accept_quote_atomic(uuid, uuid, text) from public;
revoke execute on function public.convert_lead_to_client_atomic(uuid, uuid) from public;
revoke execute on function public.rls_auto_enable() from public;

grant execute on function public.accept_quote_atomic(uuid, uuid, text) to service_role;
grant execute on function public.convert_lead_to_client_atomic(uuid, uuid) to service_role;
grant execute on function public.rls_auto_enable() to service_role;

commit;
