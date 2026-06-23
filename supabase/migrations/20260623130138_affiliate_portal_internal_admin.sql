begin;

do $preflight$
begin
  if to_regclass('public.affiliate_portal_partner_applications') is null
    or to_regclass('public.affiliate_portal_user_links') is null
    or to_regclass('public.affiliate_portal_lead_attributions') is null
    or to_regclass('public.affiliate_portal_commission_snapshots') is null
    or to_regclass('public.affiliate_portal_audit_events') is null
    or to_regclass('public.services') is null
  then
    raise exception 'Affiliate portal integration migration must be applied first';
  end if;
end
$preflight$;

do $retire_partner_app_admin_rpc$
begin
  if to_regprocedure('public.affiliate_portal_approve_application(uuid,text,uuid,text)') is not null then
    execute 'revoke all on function public.affiliate_portal_approve_application(uuid,text,uuid,text) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('public.affiliate_portal_record_manual_referral(uuid,uuid,text)') is not null then
    execute 'revoke all on function public.affiliate_portal_record_manual_referral(uuid,uuid,text) from public, anon, authenticated, service_role';
  end if;
end
$retire_partner_app_admin_rpc$;

alter table public.affiliate_portal_partner_applications
  add column preferred_commission_model text
  constraint affiliate_portal_applications_commission_model_check
  check (
    preferred_commission_model is null
    or preferred_commission_model in ('BUILD_COST', 'LIFETIME')
  );

create table public.affiliate_portal_agreements (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null
    references public.affiliates(id) on delete restrict,
  commission_model text not null
    check (commission_model in ('BUILD_COST', 'LIFETIME')),
  default_rate_percent numeric(5,2)
    check (
      default_rate_percent is null
      or (default_rate_percent > 0 and default_rate_percent <= 50)
    ),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ENDED')),
  effective_from date,
  effective_to date,
  signed_at timestamptz,
  terms_summary text,
  created_by_crm_user_id uuid
    references public.users(id) on delete set null,
  updated_by_crm_user_id uuid
    references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_portal_agreement_dates_check
    check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint affiliate_portal_active_agreement_signed_check
    check (status <> 'ACTIVE' or signed_at is not null)
);

create unique index affiliate_portal_agreements_one_active_idx
  on public.affiliate_portal_agreements(affiliate_id)
  where status = 'ACTIVE';
create index affiliate_portal_agreements_affiliate_created_idx
  on public.affiliate_portal_agreements(affiliate_id, created_at desc);
create index affiliate_portal_agreements_creator_idx
  on public.affiliate_portal_agreements(created_by_crm_user_id);
create index affiliate_portal_agreements_updater_idx
  on public.affiliate_portal_agreements(updated_by_crm_user_id);

create table public.affiliate_portal_agreement_rates (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null
    references public.affiliate_portal_agreements(id) on delete cascade,
  service_id uuid not null
    references public.services(id) on delete restrict,
  rate_percent numeric(5,2) not null
    check (rate_percent > 0 and rate_percent <= 50),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, service_id)
);

create index affiliate_portal_agreement_rates_service_idx
  on public.affiliate_portal_agreement_rates(service_id);

alter table public.affiliate_portal_commission_snapshots
  add column agreement_id uuid
    references public.affiliate_portal_agreements(id) on delete restrict,
  add column agreement_rate_id uuid
    references public.affiliate_portal_agreement_rates(id) on delete restrict,
  add column service_id uuid
    references public.services(id) on delete restrict,
  add column commission_model text
    check (
      commission_model is null
      or commission_model in ('BUILD_COST', 'LIFETIME')
    );

create index affiliate_portal_commission_snapshots_agreement_idx
  on public.affiliate_portal_commission_snapshots(agreement_id);
create index affiliate_portal_commission_snapshots_rate_idx
  on public.affiliate_portal_commission_snapshots(agreement_rate_id);
create index affiliate_portal_commission_snapshots_service_idx
  on public.affiliate_portal_commission_snapshots(service_id);

create trigger affiliate_portal_agreements_updated_at
before update on public.affiliate_portal_agreements
for each row execute function affiliate_portal_private.set_updated_at();

create trigger affiliate_portal_agreement_rates_updated_at
before update on public.affiliate_portal_agreement_rates
for each row execute function affiliate_portal_private.set_updated_at();

alter table public.affiliate_portal_agreements enable row level security;
alter table public.affiliate_portal_agreement_rates enable row level security;

revoke all on schema affiliate_portal_private from public, anon;
grant usage on schema affiliate_portal_private to authenticated;
revoke all on table public.affiliate_portal_agreements from anon, authenticated;
revoke all on table public.affiliate_portal_agreement_rates from anon, authenticated;
grant all on table public.affiliate_portal_agreements to service_role;
grant all on table public.affiliate_portal_agreement_rates to service_role;
grant select on table public.affiliate_portal_agreements to authenticated;
grant select on table public.affiliate_portal_agreement_rates to authenticated;

create function affiliate_portal_private.assert_crm_admin(
  requested_crm_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if requested_crm_user_id is null or not exists (
    select 1
    from public.users as crm_user
    join public.roles as crm_role on crm_role.id = crm_user.role_id
    where crm_user.id = requested_crm_user_id
      and crm_user.status = 'ACTIVE'
      and crm_role.permissions ? 'settings:manage'
  ) then
    raise exception 'CRM admin authorization required'
      using errcode = '42501';
  end if;
end
$function$;

revoke all on function affiliate_portal_private.assert_crm_admin(uuid)
  from public, anon, authenticated, service_role;

create function affiliate_portal_private.owns_agreement(
  requested_agreement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.affiliate_portal_agreements as agreement
      join public.affiliate_portal_user_links as link
        on link.affiliate_id = agreement.affiliate_id
      where agreement.id = requested_agreement_id
        and link.auth_user_id = (select auth.uid())
    );
$function$;

revoke all on function affiliate_portal_private.owns_agreement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function affiliate_portal_private.owns_agreement(uuid)
  to authenticated;

create policy affiliate_portal_agreements_select_own
on public.affiliate_portal_agreements
for select
to authenticated
using ((select affiliate_portal_private.owns_agreement(id)));

create policy affiliate_portal_agreement_rates_select_own
on public.affiliate_portal_agreement_rates
for select
to authenticated
using ((select affiliate_portal_private.owns_agreement(agreement_id)));

create function public.affiliate_portal_admin_approve_application(
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

  select candidate.*
  into application
  from public.affiliate_portal_partner_applications as candidate
  where candidate.id = p_application_id
  for update;

  if not found then
    raise exception 'Partner application not found' using errcode = 'P0002';
  end if;
  if application.status <> 'pending_review' then
    raise exception 'Partner application has already been reviewed'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = application.auth_user_id
      and auth_user.email_confirmed_at is not null
      and lower(auth_user.email) = lower(application.email)
  ) then
    raise exception 'Applicant email ownership has not been verified'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.affiliate_portal_user_links as existing_link
    where existing_link.auth_user_id = application.auth_user_id
      and existing_link.affiliate_id is not null
  ) then
    raise exception 'Applicant already has an affiliate mapping'
      using errcode = '23505';
  end if;

  if p_approval_mode = 'create' then
    if p_selected_affiliate_id is not null
      or p_new_tracking_code is null
      or p_new_tracking_code !~ '^[a-z0-9][a-z0-9-]{3,39}$'
    then
      raise exception 'Create mode requires a valid new tracking code only'
        using errcode = '22023';
    end if;

    insert into public.affiliates (
      name, email, tracking_code, status,
      default_commission_type, default_commission_rate
    )
    values (
      application.first_name || ' ' || application.surname,
      application.email,
      p_new_tracking_code,
      'ACTIVE',
      'ONCE_OFF',
      0
    )
    returning * into affiliate;
  elsif p_approval_mode = 'link' then
    if p_selected_affiliate_id is null or p_new_tracking_code is not null then
      raise exception 'Link mode requires one explicitly selected affiliate'
        using errcode = '22023';
    end if;

    select selected.*
    into affiliate
    from public.affiliates as selected
    where selected.id = p_selected_affiliate_id
    for update;

    if not found then
      raise exception 'Selected CRM affiliate not found' using errcode = 'P0002';
    end if;
  else
    raise exception 'Approval mode must be create or link' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.affiliate_portal_user_links as existing_link
    where existing_link.affiliate_id = affiliate.id
  ) then
    raise exception 'Selected CRM affiliate is already mapped'
      using errcode = '23505';
  end if;

  insert into public.affiliate_portal_user_links (
    auth_user_id,
    affiliate_id,
    created_by_auth_user_id
  )
  values (application.auth_user_id, affiliate.id, null);

  update public.affiliate_portal_partner_applications
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by_crm_user_id = p_actor_crm_user_id,
    rejection_reason = null,
    deletion_scheduled_at = null
  where id = application.id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_crm_user_id,
    affiliate.id,
    'approve_application',
    'affiliate_portal_partner_application',
    application.id::text,
    jsonb_build_object(
      'approval_mode', p_approval_mode,
      'tracking_code', affiliate.tracking_code
    )
  );

  return query select affiliate.id, affiliate.tracking_code;
end
$function$;

create function public.affiliate_portal_admin_decline_application(
  p_actor_crm_user_id uuid,
  p_application_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  application public.affiliate_portal_partner_applications%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Decline reason is required' using errcode = '22023';
  end if;

  select candidate.*
  into application
  from public.affiliate_portal_partner_applications as candidate
  where candidate.id = p_application_id
  for update;

  if not found then
    raise exception 'Partner application not found' using errcode = 'P0002';
  end if;
  if application.status <> 'pending_review' then
    raise exception 'Partner application has already been reviewed'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.affiliate_portal_user_links
    where auth_user_id = application.auth_user_id
      and affiliate_id is not null
  ) then
    raise exception 'Mapped affiliate accounts cannot be scheduled for deletion'
      using errcode = '23514';
  end if;

  update public.affiliate_portal_partner_applications
  set
    status = 'declined',
    reviewed_at = now(),
    reviewed_by_crm_user_id = p_actor_crm_user_id,
    rejection_reason = btrim(p_reason),
    deletion_scheduled_at = now() + interval '48 hours'
  where id = application.id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_crm_user_id,
    'decline_application',
    'affiliate_portal_partner_application',
    application.id::text,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'deletion_scheduled_after_hours', 48
    )
  );
end
$function$;

create function public.affiliate_portal_admin_record_manual_referral(
  p_actor_crm_user_id uuid,
  p_lead_id uuid,
  p_selected_affiliate_id uuid,
  p_reason text
)
returns table(crm_referral_id uuid, attribution_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  created_referral_id uuid;
  created_attribution_id uuid;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Manual attribution reason is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.leads where id = p_lead_id)
    or not exists (select 1 from public.affiliates where id = p_selected_affiliate_id)
  then
    raise exception 'CRM lead or affiliate not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.referrals where lead_id = p_lead_id) then
    raise exception 'CRM lead already has a referral' using errcode = '23505';
  end if;

  insert into public.referrals (affiliate_id, lead_id, status)
  values (p_selected_affiliate_id, p_lead_id, 'PENDING')
  returning id into created_referral_id;

  insert into public.affiliate_portal_lead_attributions (
    crm_referral_id,
    attribution_source,
    manual_attribution_reason,
    attributed_by_crm_user_id
  )
  values (created_referral_id, 'manual', btrim(p_reason), p_actor_crm_user_id)
  returning id into created_attribution_id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_crm_user_id,
    p_selected_affiliate_id,
    'record_manual_referral',
    'referral',
    created_referral_id::text,
    jsonb_build_object('lead_id', p_lead_id, 'reason', btrim(p_reason))
  );

  return query select created_referral_id, created_attribution_id;
end
$function$;

create function public.affiliate_portal_admin_create_commission(
  p_actor_crm_user_id uuid,
  p_affiliate_id uuid,
  p_quote_id uuid,
  p_project_id uuid,
  p_payment_id uuid,
  p_status text,
  p_commission_type text,
  p_base_amount_cents integer,
  p_rate_percent numeric
)
returns table(commission_id uuid, amount_cents integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  created_commission_id uuid;
  calculated_amount_cents integer;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if not exists (select 1 from public.affiliates where id = p_affiliate_id) then
    raise exception 'CRM affiliate not found' using errcode = 'P0002';
  end if;
  if num_nonnulls(p_quote_id, p_project_id, p_payment_id) = 0 then
    raise exception 'A quote, project, or payment source is required'
      using errcode = '22023';
  end if;
  if p_base_amount_cents <= 0 or p_rate_percent < 0 or p_rate_percent > 100 then
    raise exception 'Commission base and rate are invalid' using errcode = '22023';
  end if;
  if p_status not in ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED', 'DISPUTED')
    or p_commission_type not in ('ONCE_OFF', 'RECURRING')
  then
    raise exception 'Commission status or type is invalid' using errcode = '22023';
  end if;

  calculated_amount_cents := round(p_base_amount_cents * p_rate_percent / 100.0);
  if calculated_amount_cents <= 0 then
    raise exception 'Calculated commission must be positive' using errcode = '22023';
  end if;

  insert into public.commissions (
    affiliate_id,
    quote_id,
    project_id,
    payment_id,
    status,
    amount_cents,
    commission_type,
    paid_at
  )
  values (
    p_affiliate_id,
    p_quote_id,
    p_project_id,
    p_payment_id,
    p_status,
    calculated_amount_cents,
    p_commission_type,
    case when p_status = 'PAID' then now() else null end
  )
  returning id into created_commission_id;

  insert into public.affiliate_portal_commission_snapshots (
    commission_id,
    base_amount_cents,
    rate_percent,
    created_by_crm_user_id
  )
  values (
    created_commission_id,
    p_base_amount_cents,
    p_rate_percent,
    p_actor_crm_user_id
  );

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_crm_user_id,
    p_affiliate_id,
    'create_commission',
    'commission',
    created_commission_id::text,
    jsonb_build_object(
      'base_amount_cents', p_base_amount_cents,
      'rate_percent', p_rate_percent,
      'amount_cents', calculated_amount_cents,
      'commission_type', p_commission_type,
      'status', p_status
    )
  );

  return query select created_commission_id, calculated_amount_cents;
end
$function$;

create function public.affiliate_portal_admin_save_agreement(
  p_actor_crm_user_id uuid,
  p_agreement_id uuid,
  p_affiliate_id uuid,
  p_commission_model text,
  p_default_rate_percent numeric,
  p_status text,
  p_effective_from date,
  p_effective_to date,
  p_signed_at timestamptz,
  p_terms_summary text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  saved_agreement_id uuid;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if not exists (select 1 from public.affiliates where id = p_affiliate_id) then
    raise exception 'CRM affiliate not found' using errcode = 'P0002';
  end if;
  if p_commission_model not in ('BUILD_COST', 'LIFETIME')
    or p_status not in ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ENDED')
  then
    raise exception 'Agreement model or status is invalid' using errcode = '22023';
  end if;
  if p_default_rate_percent is not null
    and (p_default_rate_percent <= 0 or p_default_rate_percent > 50)
  then
    raise exception 'Agreement rate must be greater than zero and at most 50 percent'
      using errcode = '22023';
  end if;
  if p_effective_to is not null and p_effective_from is not null
    and p_effective_to < p_effective_from
  then
    raise exception 'Agreement end date cannot precede its start date'
      using errcode = '22023';
  end if;
  if p_status = 'ACTIVE' and p_signed_at is null then
    raise exception 'An active agreement must be signed' using errcode = '22023';
  end if;
  if p_status = 'ACTIVE'
    and p_default_rate_percent is null
    and (
      p_agreement_id is null
      or not exists (
        select 1 from public.affiliate_portal_agreement_rates
        where agreement_id = p_agreement_id
      )
    )
  then
    raise exception 'An active agreement requires a default or product-specific rate'
      using errcode = '22023';
  end if;

  if p_agreement_id is null then
    insert into public.affiliate_portal_agreements (
      affiliate_id,
      commission_model,
      default_rate_percent,
      status,
      effective_from,
      effective_to,
      signed_at,
      terms_summary,
      created_by_crm_user_id,
      updated_by_crm_user_id
    )
    values (
      p_affiliate_id,
      p_commission_model,
      p_default_rate_percent,
      p_status,
      p_effective_from,
      p_effective_to,
      p_signed_at,
      nullif(btrim(p_terms_summary), ''),
      p_actor_crm_user_id,
      p_actor_crm_user_id
    )
    returning id into saved_agreement_id;
  else
    update public.affiliate_portal_agreements
    set
      commission_model = p_commission_model,
      default_rate_percent = p_default_rate_percent,
      status = p_status,
      effective_from = p_effective_from,
      effective_to = p_effective_to,
      signed_at = p_signed_at,
      terms_summary = nullif(btrim(p_terms_summary), ''),
      updated_by_crm_user_id = p_actor_crm_user_id
    where id = p_agreement_id and affiliate_id = p_affiliate_id
    returning id into saved_agreement_id;

    if saved_agreement_id is null then
      raise exception 'Affiliate agreement not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_crm_user_id,
    p_affiliate_id,
    'save_affiliate_agreement',
    'affiliate_portal_agreement',
    saved_agreement_id::text,
    jsonb_build_object(
      'commission_model', p_commission_model,
      'default_rate_percent', p_default_rate_percent,
      'status', p_status
    )
  );

  return saved_agreement_id;
end
$function$;

create function public.affiliate_portal_admin_save_agreement_rate(
  p_actor_crm_user_id uuid,
  p_agreement_id uuid,
  p_service_id uuid,
  p_rate_percent numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  agreement_affiliate_id uuid;
  saved_rate_id uuid;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if p_rate_percent <= 0 or p_rate_percent > 50 then
    raise exception 'Product rate must be greater than zero and at most 50 percent'
      using errcode = '22023';
  end if;
  select affiliate_id into agreement_affiliate_id
  from public.affiliate_portal_agreements
  where id = p_agreement_id
  for update;
  if not found then
    raise exception 'Affiliate agreement not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.services where id = p_service_id) then
    raise exception 'CRM service not found' using errcode = 'P0002';
  end if;

  insert into public.affiliate_portal_agreement_rates (
    agreement_id, service_id, rate_percent, notes
  )
  values (
    p_agreement_id, p_service_id, p_rate_percent, nullif(btrim(p_notes), '')
  )
  on conflict (agreement_id, service_id) do update
  set rate_percent = excluded.rate_percent,
      notes = excluded.notes,
      updated_at = now()
  returning id into saved_rate_id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_crm_user_id,
    agreement_affiliate_id,
    'save_agreement_product_rate',
    'affiliate_portal_agreement_rate',
    saved_rate_id::text,
    jsonb_build_object('service_id', p_service_id, 'rate_percent', p_rate_percent)
  );

  return saved_rate_id;
end
$function$;

create function public.affiliate_portal_admin_create_agreement_commission(
  p_actor_crm_user_id uuid,
  p_affiliate_id uuid,
  p_service_id uuid,
  p_quote_id uuid,
  p_project_id uuid,
  p_payment_id uuid,
  p_status text,
  p_base_amount_cents integer
)
returns table(commission_id uuid, amount_cents integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  agreement public.affiliate_portal_agreements%rowtype;
  matched_rate public.affiliate_portal_agreement_rates%rowtype;
  applied_rate numeric;
  crm_commission_type text;
  created_commission_id uuid;
  calculated_amount_cents integer;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if p_base_amount_cents <= 0 then
    raise exception 'Commission base must be positive' using errcode = '22023';
  end if;
  if p_status not in ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED', 'DISPUTED') then
    raise exception 'Commission status is invalid' using errcode = '22023';
  end if;
  if num_nonnulls(p_quote_id, p_project_id, p_payment_id) = 0 then
    raise exception 'A quote, project, or payment source is required'
      using errcode = '22023';
  end if;

  select candidate.* into agreement
  from public.affiliate_portal_agreements as candidate
  where candidate.affiliate_id = p_affiliate_id
    and candidate.status = 'ACTIVE'
    and (candidate.effective_from is null or candidate.effective_from <= current_date)
    and (candidate.effective_to is null or candidate.effective_to >= current_date)
  for update;
  if not found then
    raise exception 'No active affiliate agreement is available'
      using errcode = 'P0002';
  end if;

  if p_service_id is not null then
    select rate.* into matched_rate
    from public.affiliate_portal_agreement_rates as rate
    where rate.agreement_id = agreement.id
      and rate.service_id = p_service_id;
  end if;
  applied_rate := coalesce(matched_rate.rate_percent, agreement.default_rate_percent);
  if applied_rate is null then
    raise exception 'This agreement has no rate for the selected product'
      using errcode = '22023';
  end if;

  crm_commission_type := case
    when agreement.commission_model = 'BUILD_COST' then 'ONCE_OFF'
    else 'RECURRING'
  end;
  calculated_amount_cents := round(p_base_amount_cents * applied_rate / 100.0);
  if calculated_amount_cents <= 0 then
    raise exception 'Calculated commission must be positive' using errcode = '22023';
  end if;

  insert into public.commissions (
    affiliate_id, quote_id, project_id, payment_id, status,
    amount_cents, commission_type, paid_at
  )
  values (
    p_affiliate_id, p_quote_id, p_project_id, p_payment_id, p_status,
    calculated_amount_cents, crm_commission_type,
    case when p_status = 'PAID' then now() else null end
  )
  returning id into created_commission_id;

  insert into public.affiliate_portal_commission_snapshots (
    commission_id,
    base_amount_cents,
    rate_percent,
    created_by_crm_user_id,
    agreement_id,
    agreement_rate_id,
    service_id,
    commission_model
  )
  values (
    created_commission_id,
    p_base_amount_cents,
    applied_rate,
    p_actor_crm_user_id,
    agreement.id,
    matched_rate.id,
    p_service_id,
    agreement.commission_model
  );

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  )
  values (
    p_actor_crm_user_id,
    p_affiliate_id,
    'create_commission',
    'commission',
    created_commission_id::text,
    jsonb_build_object(
      'agreement_id', agreement.id,
      'service_id', p_service_id,
      'commission_model', agreement.commission_model,
      'base_amount_cents', p_base_amount_cents,
      'rate_percent', applied_rate,
      'amount_cents', calculated_amount_cents,
      'status', p_status
    )
  );

  return query select created_commission_id, calculated_amount_cents;
end
$function$;

revoke all on function public.affiliate_portal_admin_approve_application(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_approve_application(
  uuid, uuid, text, uuid, text
) to service_role;

revoke all on function public.affiliate_portal_admin_decline_application(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_decline_application(
  uuid, uuid, text
) to service_role;

revoke all on function public.affiliate_portal_admin_record_manual_referral(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_record_manual_referral(
  uuid, uuid, uuid, text
) to service_role;

revoke all on function public.affiliate_portal_admin_create_commission(
  uuid, uuid, uuid, uuid, uuid, text, text, integer, numeric
) from public, anon, authenticated, service_role;

revoke all on function public.affiliate_portal_admin_save_agreement(
  uuid, uuid, uuid, text, numeric, text, date, date, timestamptz, text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_save_agreement(
  uuid, uuid, uuid, text, numeric, text, date, date, timestamptz, text
) to service_role;

revoke all on function public.affiliate_portal_admin_save_agreement_rate(
  uuid, uuid, uuid, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_save_agreement_rate(
  uuid, uuid, uuid, numeric, text
) to service_role;

revoke all on function public.affiliate_portal_admin_create_agreement_commission(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_create_agreement_commission(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer
) to service_role;

commit;
