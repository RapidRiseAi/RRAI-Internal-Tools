begin;

-- Returns which of the given auth users have a confirmed email, so the admin can
-- check applicant verification for just the loaded applications instead of listing
-- up to 1000 auth users (which silently broke once a project passed 1000 users).

create or replace function public.affiliate_portal_admin_verified_auth_users(
  p_auth_user_ids uuid[]
)
returns table(auth_user_id uuid)
language sql
security definer
set search_path = ''
as $function$
  select u.id
  from auth.users u
  where u.id = any(p_auth_user_ids)
    and u.email_confirmed_at is not null;
$function$;

revoke all on function public.affiliate_portal_admin_verified_auth_users(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_verified_auth_users(uuid[])
  to service_role;

commit;
