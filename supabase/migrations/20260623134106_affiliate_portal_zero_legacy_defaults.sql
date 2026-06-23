create or replace function public.affiliate_portal_admin_approve_application(
  p_actor_crm_user_id uuid,
  p_application_id uuid,
  p_approval_mode text,
  p_selected_affiliate_id uuid default null,
  p_new_tracking_code text default null
)
returns table(affiliate_id uuid, tracking_code text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  application public.affiliate_portal_partner_applications%rowtype;
  affiliate public.affiliates%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select candidate.* into application
  from public.affiliate_portal_partner_applications candidate
  where candidate.id = p_application_id for update;
  if not found then raise exception 'Partner application not found' using errcode = 'P0002'; end if;
  if application.status <> 'pending_review' then raise exception 'Partner application has already been reviewed' using errcode = '23514'; end if;
  if not exists (
    select 1 from auth.users auth_user
    where auth_user.id = application.auth_user_id
      and auth_user.email_confirmed_at is not null
      and lower(auth_user.email) = lower(application.email)
  ) then raise exception 'Applicant email ownership has not been verified' using errcode = '42501'; end if;
  if exists (
    select 1 from public.affiliate_portal_user_links existing_link
    where existing_link.auth_user_id = application.auth_user_id
      and existing_link.affiliate_id is not null
  ) then raise exception 'Applicant already has an affiliate mapping' using errcode = '23505'; end if;

  if p_approval_mode = 'create' then
    if p_selected_affiliate_id is not null or p_new_tracking_code is null
      or p_new_tracking_code !~ '^[a-z0-9][a-z0-9-]{3,39}$'
    then raise exception 'Create mode requires a valid new tracking code only' using errcode = '22023'; end if;
    insert into public.affiliates (
      name, email, tracking_code, status,
      default_commission_type, default_commission_rate
    ) values (
      application.first_name || ' ' || application.surname,
      application.email, p_new_tracking_code, 'ACTIVE', 'ONCE_OFF', 0
    ) returning * into affiliate;
  elsif p_approval_mode = 'link' then
    if p_selected_affiliate_id is null or p_new_tracking_code is not null
    then raise exception 'Link mode requires one explicitly selected affiliate' using errcode = '22023'; end if;
    select selected.* into affiliate from public.affiliates selected
    where selected.id = p_selected_affiliate_id for update;
    if not found then raise exception 'Selected CRM affiliate not found' using errcode = 'P0002'; end if;
  else
    raise exception 'Approval mode must be create or link' using errcode = '22023';
  end if;

  if exists (select 1 from public.affiliate_portal_user_links existing_link where existing_link.affiliate_id = affiliate.id)
  then raise exception 'Selected CRM affiliate is already mapped' using errcode = '23505'; end if;
  insert into public.affiliate_portal_user_links (auth_user_id, affiliate_id, created_by_auth_user_id)
  values (application.auth_user_id, affiliate.id, null);
  update public.affiliate_portal_partner_applications set
    status = 'approved', reviewed_at = now(), reviewed_by_crm_user_id = p_actor_crm_user_id,
    rejection_reason = null, deletion_scheduled_at = null
  where id = application.id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  ) values (
    p_actor_crm_user_id, affiliate.id, 'approve_application',
    'affiliate_portal_partner_application', application.id::text,
    jsonb_build_object('approval_mode', p_approval_mode, 'tracking_code', affiliate.tracking_code)
  );
  return query select affiliate.id, affiliate.tracking_code;
end
$function$;

revoke all on function public.affiliate_portal_admin_approve_application(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_approve_application(
  uuid, uuid, text, uuid, text
) to service_role;
