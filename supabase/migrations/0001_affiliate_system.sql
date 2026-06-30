begin;

-- This migration integrates the affiliate portal with the existing Rapid Rise
-- CRM. It intentionally does not alter or recreate public.affiliates,
-- public.leads, public.referrals, public.payments, or public.commissions.

do $preflight$
declare
  missing_objects text[];
begin
  select array_agg(required.name order by required.name)
  into missing_objects
  from (
    values
      ('public.affiliates'),
      ('public.leads'),
      ('public.referrals'),
      ('public.payments'),
      ('public.commissions'),
      ('public.users'),
      ('public.roles'),
      ('public.quotes'),
      ('public.projects'),
      ('public.invoices')
  ) as required(name)
  where to_regclass(required.name) is null;

  if missing_objects is not null then
    raise exception
      'Affiliate portal CRM prerequisites are missing: %',
      array_to_string(missing_objects, ', ');
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliates'
      and column_name = 'id'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliates'
      and column_name = 'tracking_code'
      and data_type = 'text'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'role_id'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'roles'
      and column_name = 'permissions'
      and data_type = 'jsonb'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'commissions'
      and column_name = 'affiliate_id'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'commissions'
      and column_name = 'amount_cents'
      and data_type = 'integer'
  ) then
    raise exception
      'Affiliate portal CRM prerequisites have drifted from the verified schema';
  end if;

  if not exists (
    select 1
    from public.roles
    where permissions ? 'settings:manage'
  ) then
    raise exception
      'No live CRM role currently grants settings:manage; admin authorization cannot be reused safely';
  end if;

  if exists (
    select 1
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname like 'affiliate_portal_%'
  ) then
    raise exception
      'Affiliate portal objects already exist; inspect them before applying this migration';
  end if;
end
$preflight$;

create type public.affiliate_portal_application_status as enum (
  'pending_review',
  'approved',
  'declined',
  'deleted_or_anonymised'
);

create schema affiliate_portal_private;
revoke all on schema affiliate_portal_private from public, anon, authenticated;

create table public.affiliate_portal_user_links (
  auth_user_id uuid primary key
    references auth.users(id) on delete cascade,
  affiliate_id uuid unique
    references public.affiliates(id) on delete restrict,
  crm_user_id uuid unique
    references public.users(id) on delete restrict,
  created_by_auth_user_id uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_portal_user_links_target_check
    check (num_nonnulls(affiliate_id, crm_user_id) >= 1)
);

comment on table public.affiliate_portal_user_links is
  'Explicit Supabase Auth mapping to an existing CRM affiliate and/or CRM user. CRM role membership remains the source of admin authorization.';

create table public.affiliate_portal_partner_applications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique
    references auth.users(id) on delete cascade,
  first_name text not null,
  surname text not null,
  business_name text not null,
  email text not null,
  phone text not null,
  website_url text,
  social_links text,
  google_business_url text,
  client_types text not null,
  motivation text not null,
  status public.affiliate_portal_application_status not null
    default 'pending_review',
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_crm_user_id uuid
    references public.users(id) on delete set null,
  deletion_scheduled_at timestamptz,
  terms_accepted_at timestamptz not null,
  internal_notes text,
  updated_at timestamptz not null default now()
);

create table public.affiliate_portal_tracking_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null
    references public.affiliates(id) on delete restrict,
  tracking_token text not null,
  destination_url text not null,
  private_reference text not null,
  channel text not null,
  notes text,
  custom_alias text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint affiliate_portal_tracking_links_token_key
    unique (affiliate_id, tracking_token),
  constraint affiliate_portal_tracking_links_destination_check
    check (destination_url like '/%' and destination_url not like '//%'),
  constraint affiliate_portal_tracking_links_token_check
    check (tracking_token ~ '^[A-Za-z0-9_-]{4,64}$'),
  constraint affiliate_portal_tracking_links_expiry_check
    check (expires_at is null or expires_at > created_at)
);

create table public.affiliate_portal_click_events (
  id uuid primary key default gen_random_uuid(),
  tracking_link_id uuid
    references public.affiliate_portal_tracking_links(id) on delete set null,
  affiliate_id uuid
    references public.affiliates(id) on delete set null,
  session_id uuid not null,
  occurred_at timestamptz not null default now(),
  landing_page text,
  referrer text,
  device_type text,
  browser text,
  country text,
  region text
);

create table public.affiliate_portal_referral_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  affiliate_id uuid
    references public.affiliates(id) on delete set null,
  tracking_link_id uuid
    references public.affiliate_portal_tracking_links(id) on delete set null,
  first_click_at timestamptz not null default now(),
  last_click_at timestamptz not null default now(),
  attribution_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint affiliate_portal_referral_sessions_window_check
    check (
      last_click_at >= first_click_at
      and attribution_expires_at > first_click_at
    )
);

create table public.affiliate_portal_lead_attributions (
  id uuid primary key default gen_random_uuid(),
  crm_referral_id uuid not null unique
    references public.referrals(id) on delete restrict,
  tracking_link_id uuid
    references public.affiliate_portal_tracking_links(id) on delete set null,
  referral_session_id uuid
    references public.affiliate_portal_referral_sessions(id) on delete set null,
  attribution_source text not null default 'tracking',
  manual_attribution_reason text,
  fraud_flag boolean not null default false,
  attributed_by_crm_user_id uuid
    references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_portal_lead_attributions_source_check
    check (attribution_source in ('tracking', 'manual', 'imported')),
  constraint affiliate_portal_lead_attributions_manual_reason_check
    check (
      attribution_source <> 'manual'
      or nullif(btrim(manual_attribution_reason), '') is not null
    )
);

create table public.affiliate_portal_commission_snapshots (
  commission_id uuid primary key
    references public.commissions(id) on delete restrict,
  base_amount_cents integer not null,
  rate_percent numeric(5,2) not null,
  created_by_crm_user_id uuid
    references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint affiliate_portal_commission_snapshots_base_check
    check (base_amount_cents >= 0),
  constraint affiliate_portal_commission_snapshots_rate_check
    check (rate_percent >= 0 and rate_percent <= 100)
);

comment on table public.affiliate_portal_commission_snapshots is
  'Immutable calculation evidence for a CRM commission. The CRM commissions row remains authoritative for type, amount, status, and paid_at.';

create table public.affiliate_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_auth_user_id uuid
    references auth.users(id) on delete set null,
  actor_crm_user_id uuid
    references public.users(id) on delete set null,
  affiliate_id uuid
    references public.affiliates(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  previous_value jsonb,
  new_value jsonb,
  occurred_at timestamptz not null default now()
);

create index affiliate_portal_user_links_created_by_idx
  on public.affiliate_portal_user_links(created_by_auth_user_id);

create index affiliate_portal_applications_status_submitted_idx
  on public.affiliate_portal_partner_applications(status, submitted_at desc);
create index affiliate_portal_applications_reviewer_idx
  on public.affiliate_portal_partner_applications(reviewed_by_crm_user_id);

create index affiliate_portal_tracking_links_affiliate_created_idx
  on public.affiliate_portal_tracking_links(affiliate_id, created_at desc);
create unique index affiliate_portal_tracking_links_alias_key
  on public.affiliate_portal_tracking_links(affiliate_id, custom_alias)
  where custom_alias is not null;

create index affiliate_portal_click_events_tracking_link_idx
  on public.affiliate_portal_click_events(tracking_link_id);
create index affiliate_portal_click_events_affiliate_time_idx
  on public.affiliate_portal_click_events(affiliate_id, occurred_at desc);
create index affiliate_portal_click_events_session_idx
  on public.affiliate_portal_click_events(session_id);

create index affiliate_portal_referral_sessions_affiliate_expiry_idx
  on public.affiliate_portal_referral_sessions(
    affiliate_id,
    attribution_expires_at desc
  );
create index affiliate_portal_referral_sessions_tracking_link_idx
  on public.affiliate_portal_referral_sessions(tracking_link_id);

create index affiliate_portal_lead_attributions_created_idx
  on public.affiliate_portal_lead_attributions(created_at desc);
create index affiliate_portal_lead_attributions_tracking_link_idx
  on public.affiliate_portal_lead_attributions(tracking_link_id);
create index affiliate_portal_lead_attributions_session_idx
  on public.affiliate_portal_lead_attributions(referral_session_id);
create index affiliate_portal_lead_attributions_actor_idx
  on public.affiliate_portal_lead_attributions(attributed_by_crm_user_id);

create index affiliate_portal_commission_snapshots_actor_idx
  on public.affiliate_portal_commission_snapshots(created_by_crm_user_id);

create index affiliate_portal_audit_events_auth_actor_idx
  on public.affiliate_portal_audit_events(actor_auth_user_id);
create index affiliate_portal_audit_events_crm_actor_idx
  on public.affiliate_portal_audit_events(actor_crm_user_id);
create index affiliate_portal_audit_events_affiliate_idx
  on public.affiliate_portal_audit_events(affiliate_id);
create index affiliate_portal_audit_events_entity_idx
  on public.affiliate_portal_audit_events(entity_type, entity_id);
create index affiliate_portal_audit_events_occurred_idx
  on public.affiliate_portal_audit_events(occurred_at desc);

create function affiliate_portal_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

create function affiliate_portal_private.owns_affiliate(
  requested_affiliate_id uuid
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
      from public.affiliate_portal_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.affiliate_id = requested_affiliate_id
    );
$function$;

create function affiliate_portal_private.is_crm_admin()
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
      from public.affiliate_portal_user_links as link
      join public.users as crm_user
        on crm_user.id = link.crm_user_id
      join public.roles as crm_role
        on crm_role.id = crm_user.role_id
      where link.auth_user_id = (select auth.uid())
        and crm_user.status = 'ACTIVE'
        and crm_role.permissions ? 'settings:manage'
    );
$function$;

create function affiliate_portal_private.owns_crm_referral(
  requested_referral_id uuid
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
      from public.referrals as referral
      join public.affiliate_portal_user_links as link
        on link.affiliate_id = referral.affiliate_id
      where referral.id = requested_referral_id
        and link.auth_user_id = (select auth.uid())
    );
$function$;

create function affiliate_portal_private.owns_commission(
  requested_commission_id uuid
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
      from public.commissions as commission
      join public.affiliate_portal_user_links as link
        on link.affiliate_id = commission.affiliate_id
      where commission.id = requested_commission_id
        and link.auth_user_id = (select auth.uid())
    );
$function$;

revoke all on function affiliate_portal_private.set_updated_at()
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.owns_affiliate(uuid)
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.is_crm_admin()
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.owns_crm_referral(uuid)
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.owns_commission(uuid)
  from public, anon, authenticated, service_role;

-- The policy helpers are not exposed by the Data API because their schema is
-- private. Authenticated requests receive only the USAGE/EXECUTE privileges
-- PostgreSQL needs to evaluate the RLS policies. The trigger helper remains
-- unavailable for direct client execution.
grant usage on schema affiliate_portal_private to authenticated;
grant execute on function affiliate_portal_private.owns_affiliate(uuid)
  to authenticated;
grant execute on function affiliate_portal_private.is_crm_admin()
  to authenticated;
grant execute on function affiliate_portal_private.owns_crm_referral(uuid)
  to authenticated;
grant execute on function affiliate_portal_private.owns_commission(uuid)
  to authenticated;

create function public.affiliate_portal_approve_application(
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
  actor_crm_user_id uuid;
begin
  if not affiliate_portal_private.is_crm_admin() then
    raise exception 'CRM admin authorization required'
      using errcode = '42501';
  end if;

  select link.crm_user_id
  into actor_crm_user_id
  from public.affiliate_portal_user_links as link
  where link.auth_user_id = (select auth.uid())
    and link.crm_user_id is not null;

  select candidate.*
  into application
  from public.affiliate_portal_partner_applications as candidate
  where candidate.id = p_application_id
  for update;

  if not found then
    raise exception 'Partner application not found'
      using errcode = 'P0002';
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
    from public.affiliate_portal_user_links as existing_user_link
    where existing_user_link.auth_user_id = application.auth_user_id
      and existing_user_link.affiliate_id is not null
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
      name,
      email,
      tracking_code,
      status
    )
    values (
      application.first_name || ' ' || application.surname,
      application.email,
      p_new_tracking_code,
      'ACTIVE'
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
      raise exception 'Selected CRM affiliate not found'
        using errcode = 'P0002';
    end if;
  else
    raise exception 'Approval mode must be create or link'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.affiliate_portal_user_links as existing_affiliate_link
    where existing_affiliate_link.affiliate_id = affiliate.id
  ) then
    raise exception 'Selected CRM affiliate is already mapped'
      using errcode = '23505';
  end if;

  insert into public.affiliate_portal_user_links (
    auth_user_id,
    affiliate_id,
    created_by_auth_user_id
  )
  values (
    application.auth_user_id,
    affiliate.id,
    (select auth.uid())
  );

  update public.affiliate_portal_partner_applications
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by_crm_user_id = actor_crm_user_id,
    rejection_reason = null,
    deletion_scheduled_at = null
  where id = application.id;

  insert into public.affiliate_portal_audit_events (
    actor_auth_user_id,
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    (select auth.uid()),
    actor_crm_user_id,
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

create function public.affiliate_portal_record_tracked_referral(
  p_lead_id uuid,
  p_session_id uuid
)
returns table(crm_referral_id uuid, attribution_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  session public.affiliate_portal_referral_sessions%rowtype;
  created_referral_id uuid;
  created_attribution_id uuid;
begin
  select candidate.*
  into session
  from public.affiliate_portal_referral_sessions as candidate
  where candidate.session_id = p_session_id
    and candidate.affiliate_id is not null
    and candidate.attribution_expires_at > now()
  for update;

  if not found then
    raise exception 'Valid referral session not found'
      using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.leads where id = p_lead_id) then
    raise exception 'CRM lead not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.referrals where referrals.lead_id = p_lead_id
  ) then
    raise exception 'CRM lead already has a referral'
      using errcode = '23505';
  end if;

  insert into public.referrals (affiliate_id, lead_id, status)
  values (session.affiliate_id, p_lead_id, 'PENDING')
  returning id into created_referral_id;

  insert into public.affiliate_portal_lead_attributions (
    crm_referral_id,
    tracking_link_id,
    referral_session_id,
    attribution_source
  )
  values (
    created_referral_id,
    session.tracking_link_id,
    session.id,
    'tracking'
  )
  returning id into created_attribution_id;

  insert into public.affiliate_portal_audit_events (
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    session.affiliate_id,
    'record_tracked_referral',
    'referral',
    created_referral_id::text,
    jsonb_build_object('lead_id', p_lead_id)
  );

  return query select created_referral_id, created_attribution_id;
end
$function$;

create function public.affiliate_portal_record_manual_referral(
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
  actor_crm_user_id uuid;
  created_referral_id uuid;
  created_attribution_id uuid;
begin
  if not affiliate_portal_private.is_crm_admin() then
    raise exception 'CRM admin authorization required'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Manual attribution reason is required'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.leads where id = p_lead_id)
    or not exists (
      select 1 from public.affiliates where id = p_selected_affiliate_id
    )
  then
    raise exception 'CRM lead or affiliate not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.referrals where referrals.lead_id = p_lead_id
  ) then
    raise exception 'CRM lead already has a referral'
      using errcode = '23505';
  end if;

  select link.crm_user_id
  into actor_crm_user_id
  from public.affiliate_portal_user_links as link
  where link.auth_user_id = (select auth.uid())
    and link.crm_user_id is not null;

  insert into public.referrals (affiliate_id, lead_id, status)
  values (p_selected_affiliate_id, p_lead_id, 'PENDING')
  returning id into created_referral_id;

  insert into public.affiliate_portal_lead_attributions (
    crm_referral_id,
    attribution_source,
    manual_attribution_reason,
    attributed_by_crm_user_id
  )
  values (
    created_referral_id,
    'manual',
    btrim(p_reason),
    actor_crm_user_id
  )
  returning id into created_attribution_id;

  insert into public.affiliate_portal_audit_events (
    actor_auth_user_id,
    actor_crm_user_id,
    affiliate_id,
    action_type,
    entity_type,
    entity_id,
    new_value
  )
  values (
    (select auth.uid()),
    actor_crm_user_id,
    p_selected_affiliate_id,
    'record_manual_referral',
    'referral',
    created_referral_id::text,
    jsonb_build_object('lead_id', p_lead_id, 'reason', btrim(p_reason))
  );

  return query select created_referral_id, created_attribution_id;
end
$function$;

create function public.affiliate_portal_record_commission_snapshot(
  p_commission_id uuid,
  p_base_amount_cents integer,
  p_rate_percent numeric,
  p_created_by_crm_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  commission_affiliate_id uuid;
begin
  select commission.affiliate_id
  into commission_affiliate_id
  from public.commissions as commission
  where commission.id = p_commission_id
  for update;

  if not found then
    raise exception 'CRM commission not found'
      using errcode = 'P0002';
  end if;

  insert into public.affiliate_portal_commission_snapshots (
    commission_id,
    base_amount_cents,
    rate_percent,
    created_by_crm_user_id
  )
  values (
    p_commission_id,
    p_base_amount_cents,
    p_rate_percent,
    p_created_by_crm_user_id
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
    p_created_by_crm_user_id,
    commission_affiliate_id,
    'record_commission_snapshot',
    'commission',
    p_commission_id::text,
    jsonb_build_object(
      'base_amount_cents', p_base_amount_cents,
      'rate_percent', p_rate_percent
    )
  );
end
$function$;

revoke all on function public.affiliate_portal_approve_application(
  uuid,
  text,
  uuid,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_approve_application(
  uuid,
  text,
  uuid,
  text
) to authenticated;

revoke all on function public.affiliate_portal_record_tracked_referral(
  uuid,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_record_tracked_referral(
  uuid,
  uuid
) to service_role;

revoke all on function public.affiliate_portal_record_manual_referral(
  uuid,
  uuid,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_record_manual_referral(
  uuid,
  uuid,
  text
) to authenticated;

revoke all on function public.affiliate_portal_record_commission_snapshot(
  uuid,
  integer,
  numeric,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_record_commission_snapshot(
  uuid,
  integer,
  numeric,
  uuid
) to service_role;

create trigger affiliate_portal_user_links_updated_at
before update on public.affiliate_portal_user_links
for each row execute function affiliate_portal_private.set_updated_at();

create trigger affiliate_portal_applications_updated_at
before update on public.affiliate_portal_partner_applications
for each row execute function affiliate_portal_private.set_updated_at();

create trigger affiliate_portal_tracking_links_updated_at
before update on public.affiliate_portal_tracking_links
for each row execute function affiliate_portal_private.set_updated_at();

create trigger affiliate_portal_referral_sessions_updated_at
before update on public.affiliate_portal_referral_sessions
for each row execute function affiliate_portal_private.set_updated_at();

create trigger affiliate_portal_lead_attributions_updated_at
before update on public.affiliate_portal_lead_attributions
for each row execute function affiliate_portal_private.set_updated_at();

alter table public.affiliate_portal_user_links enable row level security;
alter table public.affiliate_portal_partner_applications enable row level security;
alter table public.affiliate_portal_tracking_links enable row level security;
alter table public.affiliate_portal_click_events enable row level security;
alter table public.affiliate_portal_referral_sessions enable row level security;
alter table public.affiliate_portal_lead_attributions enable row level security;
alter table public.affiliate_portal_commission_snapshots enable row level security;
alter table public.affiliate_portal_audit_events enable row level security;

revoke all on table public.affiliate_portal_user_links
  from anon, authenticated;
revoke all on table public.affiliate_portal_partner_applications
  from anon, authenticated;
revoke all on table public.affiliate_portal_tracking_links
  from anon, authenticated;
revoke all on table public.affiliate_portal_click_events
  from anon, authenticated;
revoke all on table public.affiliate_portal_referral_sessions
  from anon, authenticated;
revoke all on table public.affiliate_portal_lead_attributions
  from anon, authenticated;
revoke all on table public.affiliate_portal_commission_snapshots
  from anon, authenticated;
revoke all on table public.affiliate_portal_audit_events
  from anon, authenticated;

grant all on table public.affiliate_portal_user_links to service_role;
grant all on table public.affiliate_portal_partner_applications to service_role;
grant all on table public.affiliate_portal_tracking_links to service_role;
grant all on table public.affiliate_portal_click_events to service_role;
grant all on table public.affiliate_portal_referral_sessions to service_role;
grant all on table public.affiliate_portal_lead_attributions to service_role;
grant all on table public.affiliate_portal_commission_snapshots to service_role;
grant all on table public.affiliate_portal_audit_events to service_role;

grant select on table public.affiliate_portal_user_links to authenticated;
grant select on table public.affiliate_portal_partner_applications to authenticated;
grant select, insert, update, delete
  on table public.affiliate_portal_tracking_links
  to authenticated;
grant select on table public.affiliate_portal_click_events to authenticated;
grant select on table public.affiliate_portal_referral_sessions to authenticated;
grant select on table public.affiliate_portal_lead_attributions to authenticated;
grant select on table public.affiliate_portal_commission_snapshots to authenticated;
grant select on table public.affiliate_portal_audit_events to authenticated;

create policy affiliate_portal_user_links_select_own
on public.affiliate_portal_user_links
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy affiliate_portal_user_links_admin_select
on public.affiliate_portal_user_links
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_applications_select_own
on public.affiliate_portal_partner_applications
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy affiliate_portal_applications_admin_select
on public.affiliate_portal_partner_applications
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_tracking_links_select_own
on public.affiliate_portal_tracking_links
for select
to authenticated
using (
  (select affiliate_portal_private.owns_affiliate(affiliate_id))
);

create policy affiliate_portal_tracking_links_insert_own
on public.affiliate_portal_tracking_links
for insert
to authenticated
with check (
  (select affiliate_portal_private.owns_affiliate(affiliate_id))
);

create policy affiliate_portal_tracking_links_update_own
on public.affiliate_portal_tracking_links
for update
to authenticated
using (
  (select affiliate_portal_private.owns_affiliate(affiliate_id))
)
with check (
  (select affiliate_portal_private.owns_affiliate(affiliate_id))
);

create policy affiliate_portal_tracking_links_delete_own
on public.affiliate_portal_tracking_links
for delete
to authenticated
using (
  (select affiliate_portal_private.owns_affiliate(affiliate_id))
);

create policy affiliate_portal_tracking_links_admin_all
on public.affiliate_portal_tracking_links
for all
to authenticated
using ((select affiliate_portal_private.is_crm_admin()))
with check ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_click_events_select_own
on public.affiliate_portal_click_events
for select
to authenticated
using (
  affiliate_id is not null
  and (select affiliate_portal_private.owns_affiliate(affiliate_id))
);

create policy affiliate_portal_click_events_admin_select
on public.affiliate_portal_click_events
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_referral_sessions_select_own
on public.affiliate_portal_referral_sessions
for select
to authenticated
using (
  affiliate_id is not null
  and (select affiliate_portal_private.owns_affiliate(affiliate_id))
);

create policy affiliate_portal_referral_sessions_admin_select
on public.affiliate_portal_referral_sessions
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_lead_attributions_select_own
on public.affiliate_portal_lead_attributions
for select
to authenticated
using (
  (select affiliate_portal_private.owns_crm_referral(crm_referral_id))
);

create policy affiliate_portal_lead_attributions_admin_select
on public.affiliate_portal_lead_attributions
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_commission_snapshots_select_own
on public.affiliate_portal_commission_snapshots
for select
to authenticated
using (
  (select affiliate_portal_private.owns_commission(commission_id))
);

create policy affiliate_portal_commission_snapshots_admin_select
on public.affiliate_portal_commission_snapshots
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_audit_events_admin_select
on public.affiliate_portal_audit_events
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

commit;
