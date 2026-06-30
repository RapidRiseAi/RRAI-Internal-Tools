begin;

-- P1: admin setter for the long-defined-but-unsettable fraud_flag on lead
-- attributions. CRM-admin only; audited. Flagging is informational + used to
-- exclude attributions from admin stats; it does not alter existing commissions.

create or replace function public.affiliate_portal_admin_set_attribution_fraud(
  p_actor_crm_user_id uuid,
  p_attribution_id uuid,
  p_fraud boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_affiliate_id uuid;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);

  update public.affiliate_portal_lead_attributions
    set fraud_flag = p_fraud, updated_at = now()
  where id = p_attribution_id;
  if not found then
    raise exception 'Attribution not found' using errcode = 'P0002';
  end if;

  select r.affiliate_id into v_affiliate_id
  from public.affiliate_portal_lead_attributions a
  join public.referrals r on r.id = a.crm_referral_id
  where a.id = p_attribution_id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  ) values (
    p_actor_crm_user_id, v_affiliate_id,
    case when p_fraud then 'flag_attribution_fraud' else 'clear_attribution_fraud' end,
    'affiliate_portal_lead_attribution', p_attribution_id::text,
    jsonb_build_object('fraud_flag', p_fraud, 'reason', nullif(btrim(coalesce(p_reason, '')), ''))
  );
end
$function$;

revoke all on function public.affiliate_portal_admin_set_attribution_fraud(uuid, uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_set_attribution_fraud(uuid, uuid, boolean, text)
  to service_role;

commit;
