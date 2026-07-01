begin;

-- Third commission model + build/recurring split so commissions are driven by the
-- agreement and revenue type.
--   BUILD_COST -> % of build cost (once-off)
--   RECURRING  -> % of recurring (post-build) revenue only
--   LIFETIME   -> % of everything the customer pays

alter table public.affiliate_portal_agreements
  drop constraint if exists affiliate_portal_agreements_commission_model_check;
alter table public.affiliate_portal_agreements
  add constraint affiliate_portal_agreements_commission_model_check
  check (commission_model in ('BUILD_COST', 'LIFETIME', 'RECURRING'));

alter table public.affiliate_portal_commission_snapshots
  drop constraint if exists affiliate_portal_commission_snapshots_commission_model_check;
alter table public.affiliate_portal_commission_snapshots
  add constraint affiliate_portal_commission_snapshots_commission_model_check
  check (commission_model is null or commission_model in ('BUILD_COST', 'LIFETIME', 'RECURRING'));

alter table public.affiliate_portal_partner_applications
  drop constraint if exists affiliate_portal_applications_commission_model_check;
alter table public.affiliate_portal_partner_applications
  add constraint affiliate_portal_applications_commission_model_check
  check (preferred_commission_model is null or preferred_commission_model in ('BUILD_COST', 'LIFETIME', 'RECURRING'));

-- Build vs recurring split. invoice_items.unit_amount_cents = amount charged on
-- THIS invoice (build cost for a normal invoice); recurring_cents = the monthly
-- amount that seeds a retainer. invoices.revenue_kind marks build vs recurring
-- revenue so the commission models can gate correctly.
alter table public.invoice_items
  add column if not exists recurring_cents integer not null default 0;
alter table public.invoices
  add column if not exists revenue_kind text not null default 'BUILD'
  check (revenue_kind in ('BUILD', 'RECURRING'));

-- Allow RECURRING in the agreement save RPC (only change vs the prior version is
-- the accepted model list).
create or replace function public.affiliate_portal_admin_save_agreement(
  p_actor_crm_user_id uuid, p_agreement_id uuid, p_affiliate_id uuid,
  p_commission_model text, p_default_rate_percent numeric, p_status text,
  p_effective_from date, p_effective_to date, p_signed_at timestamptz, p_terms_summary text)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  saved_agreement_id uuid;
  existing public.affiliate_portal_agreements%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if not exists (select 1 from public.affiliates where id = p_affiliate_id) then
    raise exception 'CRM affiliate not found' using errcode = 'P0002';
  end if;
  if p_commission_model not in ('BUILD_COST', 'LIFETIME', 'RECURRING') or p_status <> 'DRAFT' then
    raise exception 'Editable agreements must remain drafts until sent for electronic signature'
      using errcode = '22023';
  end if;
  if p_signed_at is not null then
    raise exception 'Agreement signatures can only be recorded by the electronic signing workflow'
      using errcode = '22023';
  end if;
  if p_default_rate_percent is not null and (p_default_rate_percent <= 0 or p_default_rate_percent > 50) then
    raise exception 'Agreement rate must be greater than zero and at most 50 percent' using errcode = '22023';
  end if;
  if p_effective_to is not null and p_effective_from is not null and p_effective_to < p_effective_from then
    raise exception 'Agreement end date cannot precede its start date' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_terms_summary, ''))) < 3 then
    raise exception 'Agreement terms are required' using errcode = '22023';
  end if;

  if p_agreement_id is null then
    insert into public.affiliate_portal_agreements (
      affiliate_id, commission_model, default_rate_percent, status,
      effective_from, effective_to, signed_at, terms_summary,
      created_by_crm_user_id, updated_by_crm_user_id
    ) values (
      p_affiliate_id, p_commission_model, p_default_rate_percent, 'DRAFT',
      p_effective_from, p_effective_to, null, btrim(p_terms_summary),
      p_actor_crm_user_id, p_actor_crm_user_id
    ) returning id into saved_agreement_id;
  else
    select * into existing from public.affiliate_portal_agreements
    where id = p_agreement_id and affiliate_id = p_affiliate_id for update;
    if not found then raise exception 'Affiliate agreement not found' using errcode = 'P0002'; end if;
    if existing.status <> 'DRAFT' or existing.signed_at is not null then
      raise exception 'Only unsigned draft agreements can be edited' using errcode = '55000';
    end if;
    update public.affiliate_portal_agreements
    set commission_model = p_commission_model, default_rate_percent = p_default_rate_percent,
        effective_from = p_effective_from, effective_to = p_effective_to,
        terms_summary = btrim(p_terms_summary), updated_by_crm_user_id = p_actor_crm_user_id
    where id = existing.id returning id into saved_agreement_id;
  end if;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  ) values (
    p_actor_crm_user_id, p_affiliate_id, 'save_affiliate_agreement',
    'affiliate_portal_agreement', saved_agreement_id::text,
    jsonb_build_object('commission_model', p_commission_model,
      'default_rate_percent', p_default_rate_percent, 'status', 'DRAFT')
  );
  return saved_agreement_id;
end
$function$;

commit;
