begin;

create function public.affiliate_portal_admin_update_affiliate(
  p_actor_crm_user_id uuid,
  p_affiliate_id uuid,
  p_name text,
  p_email text,
  p_tracking_code text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing public.affiliates%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into existing from public.affiliates where id = p_affiliate_id for update;
  if not found then raise exception 'CRM affiliate not found' using errcode = 'P0002'; end if;
  if p_status not in ('ACTIVE','PAUSED','INACTIVE') then
    raise exception 'Affiliate status is invalid' using errcode = '22023';
  end if;
  if nullif(btrim(p_name),'') is null or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Affiliate name or email is invalid' using errcode = '22023';
  end if;
  if p_tracking_code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{3,63}$' then
    raise exception 'Tracking code is invalid' using errcode = '22023';
  end if;

  update public.affiliates set
    name = btrim(p_name), email = lower(btrim(p_email)),
    tracking_code = p_tracking_code, status = p_status, updated_at = now()
  where id = p_affiliate_id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, old_value, new_value
  ) values (
    p_actor_crm_user_id, p_affiliate_id, 'update_affiliate', 'affiliate', p_affiliate_id::text,
    jsonb_build_object('name',existing.name,'email',existing.email,'tracking_code',existing.tracking_code,'status',existing.status),
    jsonb_build_object('name',btrim(p_name),'email',lower(btrim(p_email)),'tracking_code',p_tracking_code,'status',p_status)
  );
end
$function$;

create function public.affiliate_portal_admin_update_commission_status(
  p_actor_crm_user_id uuid,
  p_commission_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing public.commissions%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into existing from public.commissions where id = p_commission_id for update;
  if not found then raise exception 'Commission not found' using errcode = 'P0002'; end if;
  if existing.status = p_status then return; end if;
  if not (
    (existing.status = 'PENDING' and p_status in ('APPROVED','CANCELLED','DISPUTED')) or
    (existing.status = 'APPROVED' and p_status in ('PAYABLE','CANCELLED','DISPUTED')) or
    (existing.status = 'PAYABLE' and p_status in ('PAID','CANCELLED','DISPUTED')) or
    (existing.status = 'DISPUTED' and p_status in ('APPROVED','CANCELLED'))
  ) then
    raise exception 'Commission status transition from % to % is not allowed', existing.status, p_status
      using errcode = '22023';
  end if;

  update public.commissions set
    status = p_status,
    paid_at = case when p_status = 'PAID' then now() else paid_at end,
    updated_at = now()
  where id = p_commission_id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, old_value, new_value
  ) values (
    p_actor_crm_user_id, existing.affiliate_id, 'update_commission_status', 'commission', p_commission_id::text,
    jsonb_build_object('status',existing.status,'paid_at',existing.paid_at),
    jsonb_build_object('status',p_status,'paid_at',case when p_status = 'PAID' then now() else existing.paid_at end)
  );
end
$function$;

create function public.affiliate_portal_admin_set_tracking_link_active(
  p_actor_crm_user_id uuid,
  p_tracking_link_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing public.affiliate_portal_tracking_links%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into existing from public.affiliate_portal_tracking_links where id = p_tracking_link_id for update;
  if not found then raise exception 'Tracking link not found' using errcode = 'P0002'; end if;
  update public.affiliate_portal_tracking_links set is_active = p_is_active, updated_at = now()
  where id = p_tracking_link_id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, old_value, new_value
  ) values (
    p_actor_crm_user_id, existing.affiliate_id, 'set_tracking_link_active',
    'affiliate_portal_tracking_link', p_tracking_link_id::text,
    jsonb_build_object('is_active',existing.is_active), jsonb_build_object('is_active',p_is_active)
  );
end
$function$;

create function public.affiliate_portal_admin_delete_agreement_rate(
  p_actor_crm_user_id uuid,
  p_agreement_rate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing public.affiliate_portal_agreement_rates%rowtype;
  agreement public.affiliate_portal_agreements%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into existing from public.affiliate_portal_agreement_rates where id = p_agreement_rate_id for update;
  if not found then raise exception 'Agreement product rate not found' using errcode = 'P0002'; end if;
  select * into agreement from public.affiliate_portal_agreements where id = existing.agreement_id for update;
  if agreement.status = 'ACTIVE' and agreement.default_rate_percent is null and
    (select count(*) from public.affiliate_portal_agreement_rates where agreement_id = agreement.id) <= 1
  then raise exception 'The final rate cannot be removed from an active agreement without a default rate' using errcode = '22023'; end if;
  if exists (select 1 from public.affiliate_portal_commission_snapshots where agreement_rate_id = existing.id) then
    raise exception 'A rate used by a commission snapshot cannot be deleted; replace it instead' using errcode = '23503';
  end if;
  delete from public.affiliate_portal_agreement_rates where id = existing.id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, old_value
  ) values (
    p_actor_crm_user_id, agreement.affiliate_id, 'delete_agreement_product_rate',
    'affiliate_portal_agreement_rate', existing.id::text,
    jsonb_build_object('service_id',existing.service_id,'rate_percent',existing.rate_percent,'notes',existing.notes)
  );
end
$function$;

revoke all on function public.affiliate_portal_admin_update_affiliate(uuid,uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_update_affiliate(uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.affiliate_portal_admin_update_commission_status(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_update_commission_status(uuid,uuid,text) to service_role;
revoke all on function public.affiliate_portal_admin_set_tracking_link_active(uuid,uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_set_tracking_link_active(uuid,uuid,boolean) to service_role;
revoke all on function public.affiliate_portal_admin_delete_agreement_rate(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_delete_agreement_rate(uuid,uuid) to service_role;

commit;
