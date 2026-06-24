begin;

alter table public.affiliate_portal_agreements
  add column signature_requested_at timestamptz,
  add column signature_requested_by_crm_user_id uuid
    references public.users(id) on delete set null,
  add column signature_request_expires_at timestamptz;

alter table public.affiliate_portal_agreements
  drop constraint affiliate_portal_agreements_status_check,
  add constraint affiliate_portal_agreements_status_check
    check (status in ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'SUSPENDED', 'ENDED'));

create unique index affiliate_portal_agreements_one_pending_signature_per_affiliate_idx
  on public.affiliate_portal_agreements (affiliate_id)
  where status = 'PENDING_SIGNATURE';

create index affiliate_portal_agreements_signature_expiry_idx
  on public.affiliate_portal_agreements (signature_request_expires_at)
  where status = 'PENDING_SIGNATURE';

create table public.affiliate_portal_agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null unique
    references public.affiliate_portal_agreements(id) on delete restrict,
  signed_by_auth_user_id uuid not null
    references auth.users(id) on delete restrict,
  signer_name text not null
    check (char_length(btrim(signer_name)) between 2 and 200),
  signer_email text not null
    check (char_length(btrim(signer_email)) between 3 and 320),
  signature_strokes jsonb not null
    check (
      jsonb_typeof(signature_strokes) = 'array'
      and jsonb_array_length(signature_strokes) between 1 and 200
      and octet_length(signature_strokes::text) <= 262144
    ),
  consent_version text not null,
  consent_text text not null,
  agreement_snapshot jsonb not null,
  agreement_sha256 text not null
    check (agreement_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now()
);

comment on table public.affiliate_portal_agreement_signatures is
  'Immutable evidence for affiliate electronic signatures. IP addresses and user-agent fingerprints are intentionally not stored.';

create index affiliate_portal_agreement_signatures_auth_user_idx
  on public.affiliate_portal_agreement_signatures (signed_by_auth_user_id);
create index affiliate_portal_agreement_signatures_signed_at_idx
  on public.affiliate_portal_agreement_signatures (signed_at desc);

create table public.affiliate_portal_notification_preferences (
  auth_user_id uuid primary key
    references auth.users(id) on delete cascade,
  application_updates boolean not null default true,
  agreement_updates boolean not null default true,
  referral_updates boolean not null default true,
  commission_created boolean not null default true,
  commission_status_updates boolean not null default true,
  commission_paid boolean not null default true,
  payout_summaries boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_portal_payout_batches (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    check (char_length(btrim(reference)) between 3 and 100),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PROCESSING', 'PAID', 'CANCELLED')),
  scheduled_for date,
  paid_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by_crm_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'PAID') = (paid_at is not null))
);

create table public.affiliate_portal_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null
    references public.affiliate_portal_payout_batches(id) on delete restrict,
  commission_id uuid not null unique
    references public.commissions(id) on delete restrict,
  affiliate_id uuid not null
    references public.affiliates(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

comment on table public.affiliate_portal_payout_batches is
  'Administrative payout groups. CRM commissions remain the source of truth for earned and paid status.';
comment on table public.affiliate_portal_payout_items is
  'Immutable payout membership and amount snapshots for payable CRM commissions.';

create index affiliate_portal_payout_batches_status_date_idx
  on public.affiliate_portal_payout_batches (status, scheduled_for);
create index affiliate_portal_payout_batches_creator_idx
  on public.affiliate_portal_payout_batches (created_by_crm_user_id);
create index affiliate_portal_payout_items_batch_idx
  on public.affiliate_portal_payout_items (payout_batch_id);
create index affiliate_portal_payout_items_affiliate_idx
  on public.affiliate_portal_payout_items (affiliate_id);

create trigger affiliate_portal_payout_batches_set_updated_at
before update on public.affiliate_portal_payout_batches
for each row execute function affiliate_portal_private.set_updated_at();

alter table public.affiliate_portal_commission_snapshots
  add column automation_key text unique,
  add column calculation_source text not null default 'MANUAL'
    check (calculation_source in ('MANUAL', 'PAYMENT_AUTOMATION'));

create index affiliate_portal_commission_snapshots_source_idx
  on public.affiliate_portal_commission_snapshots (calculation_source, created_at);

comment on table public.affiliate_portal_notification_preferences is
  'Per-category affiliate email choices. Missing rows use the documented opt-in defaults.';

create trigger affiliate_portal_notification_preferences_set_updated_at
before update on public.affiliate_portal_notification_preferences
for each row execute function affiliate_portal_private.set_updated_at();

create function affiliate_portal_private.prevent_signature_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'Electronic signature evidence is immutable'
    using errcode = '55000';
end
$function$;

create function affiliate_portal_private.owns_payout_batch(requested_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.affiliate_portal_payout_items item
    join public.affiliate_portal_user_links link
      on link.affiliate_id = item.affiliate_id
    where item.payout_batch_id = requested_batch_id
      and link.auth_user_id = (select auth.uid())
  );
$function$;

create trigger affiliate_portal_signature_immutable
before update or delete on public.affiliate_portal_agreement_signatures
for each row execute function affiliate_portal_private.prevent_signature_mutation();

create function affiliate_portal_private.protect_signed_agreement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.signed_at is not null and (
    new.affiliate_id is distinct from old.affiliate_id
    or new.commission_model is distinct from old.commission_model
    or new.default_rate_percent is distinct from old.default_rate_percent
    or new.effective_from is distinct from old.effective_from
    or new.effective_to is distinct from old.effective_to
    or new.signed_at is distinct from old.signed_at
    or new.terms_summary is distinct from old.terms_summary
  ) then
    raise exception 'Signed agreement terms are immutable; create a new agreement version'
      using errcode = '55000';
  end if;
  if old.status = 'PENDING_SIGNATURE' and (
    new.affiliate_id is distinct from old.affiliate_id
    or new.commission_model is distinct from old.commission_model
    or new.default_rate_percent is distinct from old.default_rate_percent
    or new.effective_from is distinct from old.effective_from
    or new.effective_to is distinct from old.effective_to
    or new.terms_summary is distinct from old.terms_summary
    or (
      new.signed_at is distinct from old.signed_at
      and not exists (
        select 1 from public.affiliate_portal_agreement_signatures signature
        where signature.agreement_id = old.id
      )
    )
  ) then
    raise exception 'Agreement terms are locked while a signature is pending'
      using errcode = '55000';
  end if;
  return new;
end
$function$;

create trigger affiliate_portal_agreements_protect_signed
before update on public.affiliate_portal_agreements
for each row execute function affiliate_portal_private.protect_signed_agreement();

create function affiliate_portal_private.protect_signed_agreement_rate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_agreement_id uuid := coalesce(new.agreement_id, old.agreement_id);
begin
  if exists (
    select 1
    from public.affiliate_portal_agreements agreement
    where agreement.id = target_agreement_id
      and (agreement.signed_at is not null or agreement.status <> 'DRAFT')
  ) then
    raise exception 'Rates can only be changed while the agreement is an unsigned draft'
      using errcode = '55000';
  end if;
  return coalesce(new, old);
end
$function$;

create trigger affiliate_portal_agreement_rates_protect_signed
before insert or update or delete on public.affiliate_portal_agreement_rates
for each row execute function affiliate_portal_private.protect_signed_agreement_rate();

create or replace function public.affiliate_portal_admin_save_agreement(
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
  existing public.affiliate_portal_agreements%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if not exists (select 1 from public.affiliates where id = p_affiliate_id) then
    raise exception 'CRM affiliate not found' using errcode = 'P0002';
  end if;
  if p_commission_model not in ('BUILD_COST', 'LIFETIME') or p_status <> 'DRAFT' then
    raise exception 'Editable agreements must remain drafts until sent for electronic signature'
      using errcode = '22023';
  end if;
  if p_signed_at is not null then
    raise exception 'Agreement signatures can only be recorded by the electronic signing workflow'
      using errcode = '22023';
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
    select * into existing
    from public.affiliate_portal_agreements
    where id = p_agreement_id and affiliate_id = p_affiliate_id
    for update;
    if not found then
      raise exception 'Affiliate agreement not found' using errcode = 'P0002';
    end if;
    if existing.status <> 'DRAFT' or existing.signed_at is not null then
      raise exception 'Only unsigned draft agreements can be edited'
        using errcode = '55000';
    end if;
    update public.affiliate_portal_agreements
    set commission_model = p_commission_model,
        default_rate_percent = p_default_rate_percent,
        effective_from = p_effective_from,
        effective_to = p_effective_to,
        terms_summary = btrim(p_terms_summary),
        updated_by_crm_user_id = p_actor_crm_user_id
    where id = existing.id
    returning id into saved_agreement_id;
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

create function public.affiliate_portal_admin_send_agreement_for_signature(
  p_actor_crm_user_id uuid,
  p_agreement_id uuid
)
returns table(auth_user_id uuid, recipient_email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  agreement public.affiliate_portal_agreements%rowtype;
  linked_auth_user_id uuid;
  linked_email text;
  request_expiry timestamptz := now() + interval '30 days';
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select candidate.* into agreement
  from public.affiliate_portal_agreements candidate
  where candidate.id = p_agreement_id
  for update;
  if not found then raise exception 'Affiliate agreement not found' using errcode = 'P0002'; end if;
  if agreement.status <> 'DRAFT' or agreement.signed_at is not null then
    raise exception 'Only an unsigned draft can be sent for signature' using errcode = '55000';
  end if;
  if agreement.default_rate_percent is null and not exists (
    select 1 from public.affiliate_portal_agreement_rates rate
    where rate.agreement_id = agreement.id
  ) then
    raise exception 'Add a default or product-specific commission rate before sending'
      using errcode = '22023';
  end if;
  if agreement.effective_to is not null and agreement.effective_to < current_date then
    raise exception 'The agreement end date has already passed' using errcode = '22023';
  end if;

  select link.auth_user_id, auth_user.email
    into linked_auth_user_id, linked_email
  from public.affiliate_portal_user_links link
  join auth.users auth_user on auth_user.id = link.auth_user_id
  where link.affiliate_id = agreement.affiliate_id
    and auth_user.email_confirmed_at is not null
  for update of link;
  if linked_auth_user_id is null then
    raise exception 'Affiliate requires a verified portal user before signing'
      using errcode = '42501';
  end if;

  update public.affiliate_portal_agreements
  set status = 'PENDING_SIGNATURE',
      signature_requested_at = now(),
      signature_requested_by_crm_user_id = p_actor_crm_user_id,
      signature_request_expires_at = request_expiry,
      updated_by_crm_user_id = p_actor_crm_user_id
  where id = agreement.id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  ) values (
    p_actor_crm_user_id, agreement.affiliate_id, 'request_agreement_signature',
    'affiliate_portal_agreement', agreement.id::text,
    jsonb_build_object('expires_at', request_expiry)
  );
  return query select linked_auth_user_id, linked_email, request_expiry;
end
$function$;

create function public.affiliate_portal_admin_cancel_signature_request(
  p_actor_crm_user_id uuid,
  p_agreement_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  agreement public.affiliate_portal_agreements%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into agreement from public.affiliate_portal_agreements
  where id = p_agreement_id for update;
  if not found then raise exception 'Affiliate agreement not found' using errcode = 'P0002'; end if;
  if agreement.status <> 'PENDING_SIGNATURE' or agreement.signed_at is not null then
    raise exception 'Agreement does not have a pending signature request' using errcode = '55000';
  end if;
  update public.affiliate_portal_agreements
  set status = 'DRAFT', signature_requested_at = null,
      signature_requested_by_crm_user_id = null,
      signature_request_expires_at = null,
      updated_by_crm_user_id = p_actor_crm_user_id
  where id = agreement.id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id
  ) values (
    p_actor_crm_user_id, agreement.affiliate_id, 'cancel_agreement_signature_request',
    'affiliate_portal_agreement', agreement.id::text
  );
end
$function$;

create function public.affiliate_portal_admin_update_agreement_status(
  p_actor_crm_user_id uuid,
  p_agreement_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  agreement public.affiliate_portal_agreements%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into agreement from public.affiliate_portal_agreements
  where id = p_agreement_id for update;
  if not found then raise exception 'Affiliate agreement not found' using errcode = 'P0002'; end if;
  if agreement.signed_at is null or p_status not in ('ACTIVE', 'SUSPENDED', 'ENDED') then
    raise exception 'Only signed agreements can use an operational status'
      using errcode = '22023';
  end if;
  if p_status = 'ACTIVE' and exists (
    select 1 from public.affiliate_portal_agreements other
    where other.affiliate_id = agreement.affiliate_id
      and other.status = 'ACTIVE' and other.id <> agreement.id
  ) then
    raise exception 'Affiliate already has another active agreement' using errcode = '23505';
  end if;
  update public.affiliate_portal_agreements
  set status = p_status, updated_by_crm_user_id = p_actor_crm_user_id
  where id = agreement.id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id,
    previous_value, new_value
  ) values (
    p_actor_crm_user_id, agreement.affiliate_id, 'update_agreement_status',
    'affiliate_portal_agreement', agreement.id::text,
    jsonb_build_object('status', agreement.status), jsonb_build_object('status', p_status)
  );
end
$function$;

create function public.affiliate_portal_sign_agreement(
  p_auth_user_id uuid,
  p_agreement_id uuid,
  p_signer_name text,
  p_signature_strokes jsonb
)
returns table(signature_id uuid, signed_at timestamptz, agreement_sha256 text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  agreement public.affiliate_portal_agreements%rowtype;
  mapped_affiliate_id uuid;
  verified_email text;
  snapshot jsonb;
  snapshot_sha256 text;
  created_signature_id uuid;
  signed_timestamp timestamptz := now();
  consent_copy constant text := 'I have reviewed this agreement, consent to use an electronic signature, and intend this signature to have the same legal effect as my handwritten signature.';
begin
  if char_length(btrim(coalesce(p_signer_name, ''))) not between 2 and 200 then
    raise exception 'Enter the signer legal name' using errcode = '22023';
  end if;
  if jsonb_typeof(p_signature_strokes) <> 'array'
    or jsonb_array_length(p_signature_strokes) not between 1 and 200
    or octet_length(p_signature_strokes::text) > 262144
  then
    raise exception 'Signature drawing is invalid' using errcode = '22023';
  end if;

  select link.affiliate_id, auth_user.email
    into mapped_affiliate_id, verified_email
  from public.affiliate_portal_user_links link
  join auth.users auth_user on auth_user.id = link.auth_user_id
  where link.auth_user_id = p_auth_user_id
    and link.affiliate_id is not null
    and auth_user.email_confirmed_at is not null;
  if mapped_affiliate_id is null then
    raise exception 'A verified affiliate portal account is required' using errcode = '42501';
  end if;

  select candidate.* into agreement
  from public.affiliate_portal_agreements candidate
  where candidate.id = p_agreement_id
    and candidate.affiliate_id = mapped_affiliate_id
  for update;
  if not found then raise exception 'Agreement not found' using errcode = 'P0002'; end if;
  if agreement.status <> 'PENDING_SIGNATURE' or agreement.signed_at is not null then
    raise exception 'Agreement is not available for signature' using errcode = '55000';
  end if;
  if agreement.signature_request_expires_at is not null
    and agreement.signature_request_expires_at <= signed_timestamp
  then
    raise exception 'Signature request has expired' using errcode = '22023';
  end if;
  if exists (select 1 from public.affiliate_portal_agreement_signatures where agreement_id = agreement.id) then
    raise exception 'Agreement has already been signed' using errcode = '23505';
  end if;

  snapshot := jsonb_build_object(
    'agreement_id', agreement.id,
    'affiliate_id', agreement.affiliate_id,
    'commission_model', agreement.commission_model,
    'default_rate_percent', agreement.default_rate_percent,
    'effective_from', agreement.effective_from,
    'effective_to', agreement.effective_to,
    'terms_summary', agreement.terms_summary,
    'product_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'service_id', rate.service_id,
        'service_name', service.name,
        'rate_percent', rate.rate_percent,
        'notes', rate.notes
      ) order by rate.service_id)
      from public.affiliate_portal_agreement_rates rate
      join public.services service on service.id = rate.service_id
      where rate.agreement_id = agreement.id
    ), '[]'::jsonb)
  );
  snapshot_sha256 := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.affiliate_portal_agreements
  set status = 'ENDED', updated_at = signed_timestamp
  where affiliate_id = agreement.affiliate_id
    and status = 'ACTIVE' and id <> agreement.id;

  insert into public.affiliate_portal_agreement_signatures (
    agreement_id, signed_by_auth_user_id, signer_name, signer_email,
    signature_strokes, consent_version, consent_text,
    agreement_snapshot, agreement_sha256, signed_at
  ) values (
    agreement.id, p_auth_user_id, btrim(p_signer_name), lower(verified_email),
    p_signature_strokes, 'affiliate-agreement-v1', consent_copy,
    snapshot, snapshot_sha256, signed_timestamp
  ) returning id into created_signature_id;

  update public.affiliate_portal_agreements
  set status = 'ACTIVE', signed_at = signed_timestamp, updated_at = signed_timestamp
  where id = agreement.id;

  insert into public.affiliate_portal_audit_events (
    actor_auth_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  ) values (
    p_auth_user_id, agreement.affiliate_id, 'sign_affiliate_agreement',
    'affiliate_portal_agreement_signature', created_signature_id::text,
    jsonb_build_object('agreement_id', agreement.id,
      'agreement_sha256', snapshot_sha256, 'consent_version', 'affiliate-agreement-v1')
  );
  return query select created_signature_id, signed_timestamp, snapshot_sha256;
end
$function$;

create function public.affiliate_portal_admin_create_payout_batch(
  p_actor_crm_user_id uuid,
  p_reference text,
  p_scheduled_for date,
  p_notes text,
  p_commission_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  created_batch_id uuid;
  selected_count integer;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  if char_length(btrim(coalesce(p_reference, ''))) not between 3 and 100 then
    raise exception 'Payout reference must contain 3 to 100 characters' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_commission_ids), 0) = 0 then
    raise exception 'Select at least one payable commission' using errcode = '22023';
  end if;
  if cardinality(p_commission_ids) <> (
    select count(distinct selected_id) from unnest(p_commission_ids) selected_id
  ) then
    raise exception 'A commission cannot be selected twice' using errcode = '22023';
  end if;
  select count(*) into selected_count
  from public.commissions commission
  where commission.id = any(p_commission_ids)
    and commission.status = 'PAYABLE'
    and commission.paid_at is null;
  if selected_count <> cardinality(p_commission_ids) then
    raise exception 'Every selected commission must still be payable and unpaid'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.affiliate_portal_payout_items item
    where item.commission_id = any(p_commission_ids)
  ) then
    raise exception 'A selected commission already belongs to a payout batch'
      using errcode = '23505';
  end if;

  insert into public.affiliate_portal_payout_batches (
    reference, scheduled_for, notes, created_by_crm_user_id
  ) values (
    btrim(p_reference), p_scheduled_for, nullif(btrim(p_notes), ''), p_actor_crm_user_id
  ) returning id into created_batch_id;

  insert into public.affiliate_portal_payout_items (
    payout_batch_id, commission_id, affiliate_id, amount_cents
  )
  select created_batch_id, commission.id, commission.affiliate_id, commission.amount_cents
  from public.commissions commission
  where commission.id = any(p_commission_ids);

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id, new_value
  )
  select p_actor_crm_user_id, item.affiliate_id, 'create_payout_batch',
    'affiliate_portal_payout_batch', created_batch_id::text,
    jsonb_build_object('reference', btrim(p_reference),
      'commission_count', count(*), 'amount_cents', sum(item.amount_cents))
  from public.affiliate_portal_payout_items item
  where item.payout_batch_id = created_batch_id
  group by item.affiliate_id;
  return created_batch_id;
end
$function$;

create function public.affiliate_portal_admin_update_payout_batch_status(
  p_actor_crm_user_id uuid,
  p_payout_batch_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  batch public.affiliate_portal_payout_batches%rowtype;
begin
  perform affiliate_portal_private.assert_crm_admin(p_actor_crm_user_id);
  select * into batch from public.affiliate_portal_payout_batches
  where id = p_payout_batch_id for update;
  if not found then raise exception 'Payout batch not found' using errcode = 'P0002'; end if;
  if batch.status = p_status then return; end if;
  if not (
    (batch.status = 'DRAFT' and p_status in ('PROCESSING', 'CANCELLED')) or
    (batch.status = 'PROCESSING' and p_status in ('PAID', 'CANCELLED'))
  ) then
    raise exception 'Payout status transition from % to % is not allowed', batch.status, p_status
      using errcode = '22023';
  end if;
  if p_status = 'PAID' and exists (
    select 1
    from public.affiliate_portal_payout_items item
    join public.commissions commission on commission.id = item.commission_id
    where item.payout_batch_id = batch.id
      and (commission.status <> 'PAYABLE' or commission.paid_at is not null)
  ) then
    raise exception 'Every payout commission must still be payable before marking the batch paid'
      using errcode = '55000';
  end if;

  if p_status = 'PAID' then
    update public.commissions commission
    set status = 'PAID', paid_at = now(), updated_at = now()
    from public.affiliate_portal_payout_items item
    where item.payout_batch_id = batch.id and item.commission_id = commission.id;
  end if;
  update public.affiliate_portal_payout_batches
  set status = p_status, paid_at = case when p_status = 'PAID' then now() else null end
  where id = batch.id;

  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id,
    previous_value, new_value
  )
  select p_actor_crm_user_id, item.affiliate_id, 'update_payout_batch_status',
    'affiliate_portal_payout_batch', batch.id::text,
    jsonb_build_object('status', batch.status),
    jsonb_build_object('status', p_status,
      'amount_cents', sum(item.amount_cents), 'commission_count', count(*))
  from public.affiliate_portal_payout_items item
  where item.payout_batch_id = batch.id
  group by item.affiliate_id;
end
$function$;

create function affiliate_portal_private.create_commissions_for_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invoice_record public.invoices%rowtype;
  quote_record public.quotes%rowtype;
  referral_record public.referrals%rowtype;
  agreement public.affiliate_portal_agreements%rowtype;
  item record;
  matched_rate_id uuid;
  matched_rate_percent numeric;
  applied_rate numeric;
  base_cents integer;
  calculated_cents integer;
  created_commission_id uuid;
  key text;
begin
  if new.status <> 'PAID' or (tg_op = 'UPDATE' and old.status = 'PAID') then
    return new;
  end if;
  select * into invoice_record from public.invoices where id = new.invoice_id;
  if not found or invoice_record.quote_id is null then return new; end if;
  select * into quote_record from public.quotes where id = invoice_record.quote_id for update;
  if not found then return new; end if;
  select candidate.* into referral_record
  from public.referrals candidate
  where (quote_record.lead_id is not null and candidate.lead_id = quote_record.lead_id)
     or (quote_record.client_id is not null and candidate.client_id = quote_record.client_id)
  order by (candidate.lead_id = quote_record.lead_id) desc, candidate.created_at
  limit 1;
  if not found then return new; end if;
  select candidate.* into agreement
  from public.affiliate_portal_agreements candidate
  where candidate.affiliate_id = referral_record.affiliate_id
    and candidate.status = 'ACTIVE'
    and (candidate.effective_from is null or candidate.effective_from <= current_date)
    and (candidate.effective_to is null or candidate.effective_to >= current_date)
  limit 1;
  if not found then return new; end if;

  if agreement.commission_model = 'LIFETIME' then
    key := 'lifetime-payment:' || new.id::text;
    if agreement.default_rate_percent is null
      or exists (select 1 from public.affiliate_portal_commission_snapshots where automation_key = key)
    then return new; end if;
    calculated_cents := round(new.amount_cents * agreement.default_rate_percent / 100.0);
    if calculated_cents <= 0 then return new; end if;
    insert into public.commissions (
      affiliate_id, quote_id, payment_id, status, amount_cents, commission_type
    ) values (
      agreement.affiliate_id, quote_record.id, new.id, 'PENDING', calculated_cents, 'RECURRING'
    ) returning id into created_commission_id;
    insert into public.affiliate_portal_commission_snapshots (
      commission_id, base_amount_cents, rate_percent, agreement_id,
      service_id, commission_model, automation_key, calculation_source
    ) values (
      created_commission_id, new.amount_cents, agreement.default_rate_percent,
      agreement.id, null, agreement.commission_model, key, 'PAYMENT_AUTOMATION'
    );
    insert into public.affiliate_portal_audit_events (
      affiliate_id, action_type, entity_type, entity_id, new_value
    ) values (
      agreement.affiliate_id, 'automate_commission_from_payment', 'commission',
      created_commission_id::text,
      jsonb_build_object('payment_id', new.id, 'agreement_id', agreement.id,
        'base_amount_cents', new.amount_cents, 'rate_percent', agreement.default_rate_percent,
        'amount_cents', calculated_cents, 'commission_model', agreement.commission_model)
    );
  else
    for item in
      select quote_item.id, quote_item.service_id,
        quote_item.quantity * quote_item.once_off_cents as line_base_cents
      from public.quote_items quote_item
      where quote_item.quote_id = quote_record.id and quote_item.once_off_cents > 0
    loop
      key := 'build-quote-item:' || item.id::text;
      if exists (select 1 from public.affiliate_portal_commission_snapshots where automation_key = key) then
        continue;
      end if;
      matched_rate_id := null;
      matched_rate_percent := null;
      if item.service_id is not null then
        select rate.id, rate.rate_percent into matched_rate_id, matched_rate_percent
        from public.affiliate_portal_agreement_rates rate
        where rate.agreement_id = agreement.id and rate.service_id = item.service_id;
      end if;
      applied_rate := coalesce(matched_rate_percent, agreement.default_rate_percent);
      base_cents := item.line_base_cents;
      if applied_rate is null or base_cents <= 0 then continue; end if;
      calculated_cents := round(base_cents * applied_rate / 100.0);
      if calculated_cents <= 0 then continue; end if;
      insert into public.commissions (
        affiliate_id, quote_id, payment_id, status, amount_cents, commission_type
      ) values (
        agreement.affiliate_id, quote_record.id, new.id, 'PENDING',
        calculated_cents, 'ONCE_OFF'
      ) returning id into created_commission_id;
      insert into public.affiliate_portal_commission_snapshots (
        commission_id, base_amount_cents, rate_percent, agreement_id,
        agreement_rate_id, service_id, commission_model, automation_key,
        calculation_source
      ) values (
        created_commission_id, base_cents, applied_rate, agreement.id,
        matched_rate_id, item.service_id, agreement.commission_model, key,
        'PAYMENT_AUTOMATION'
      );
      insert into public.affiliate_portal_audit_events (
        affiliate_id, action_type, entity_type, entity_id, new_value
      ) values (
        agreement.affiliate_id, 'automate_commission_from_payment', 'commission',
        created_commission_id::text,
        jsonb_build_object('payment_id', new.id, 'quote_item_id', item.id,
          'agreement_id', agreement.id, 'base_amount_cents', base_cents,
          'rate_percent', applied_rate, 'amount_cents', calculated_cents,
          'commission_model', agreement.commission_model)
      );
    end loop;
  end if;
  return new;
end
$function$;

create trigger affiliate_portal_create_commissions_from_paid_payment
after insert or update of status on public.payments
for each row execute function affiliate_portal_private.create_commissions_for_paid_payment();

create function public.affiliate_portal_expire_signature_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  expired_count integer;
begin
  with expired as (
    update public.affiliate_portal_agreements
    set status = 'DRAFT', signature_requested_at = null,
        signature_requested_by_crm_user_id = null,
        signature_request_expires_at = null,
        updated_at = now()
    where status = 'PENDING_SIGNATURE'
      and signature_request_expires_at <= now()
    returning id, affiliate_id
  ), audited as (
    insert into public.affiliate_portal_audit_events (
      affiliate_id, action_type, entity_type, entity_id,
      new_value
    )
    select affiliate_id, 'expire_agreement_signature_request',
      'affiliate_portal_agreement', id::text,
      jsonb_build_object('reason', 'signature_request_expired')
    from expired
  )
  select count(*) into expired_count from expired;
  return expired_count;
end
$function$;

-- Repair latent audit-column references in previously deployed management RPCs.
create or replace function public.affiliate_portal_admin_update_commission_status(
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
  update public.commissions set status = p_status,
    paid_at = case when p_status = 'PAID' then now() else paid_at end,
    updated_at = now()
  where id = p_commission_id;
  insert into public.affiliate_portal_audit_events (
    actor_crm_user_id, affiliate_id, action_type, entity_type, entity_id,
    previous_value, new_value
  ) values (
    p_actor_crm_user_id, existing.affiliate_id, 'update_commission_status',
    'commission', p_commission_id::text,
    jsonb_build_object('status', existing.status, 'paid_at', existing.paid_at),
    jsonb_build_object('status', p_status,
      'paid_at', case when p_status = 'PAID' then now() else existing.paid_at end)
  );
end
$function$;

alter table public.affiliate_portal_agreement_signatures enable row level security;
alter table public.affiliate_portal_notification_preferences enable row level security;
alter table public.affiliate_portal_payout_batches enable row level security;
alter table public.affiliate_portal_payout_items enable row level security;

revoke all on table public.affiliate_portal_agreement_signatures from anon, authenticated;
revoke all on table public.affiliate_portal_notification_preferences from anon, authenticated;
revoke all on table public.affiliate_portal_payout_batches from anon, authenticated;
revoke all on table public.affiliate_portal_payout_items from anon, authenticated;
grant all on table public.affiliate_portal_agreement_signatures to service_role;
grant all on table public.affiliate_portal_notification_preferences to service_role;
grant all on table public.affiliate_portal_payout_batches to service_role;
grant all on table public.affiliate_portal_payout_items to service_role;
grant select on table public.affiliate_portal_agreement_signatures to authenticated;
grant select, insert, update on table public.affiliate_portal_notification_preferences to authenticated;
grant select on table public.affiliate_portal_payout_batches to authenticated;
grant select on table public.affiliate_portal_payout_items to authenticated;

create policy affiliate_portal_agreement_signatures_select_own
on public.affiliate_portal_agreement_signatures
for select
to authenticated
using ((select affiliate_portal_private.owns_agreement(agreement_id)));

create policy affiliate_portal_agreement_signatures_admin_select
on public.affiliate_portal_agreement_signatures
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_notification_preferences_select_own
on public.affiliate_portal_notification_preferences
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy affiliate_portal_notification_preferences_insert_own
on public.affiliate_portal_notification_preferences
for insert
to authenticated
with check (auth_user_id = (select auth.uid()));

create policy affiliate_portal_notification_preferences_update_own
on public.affiliate_portal_notification_preferences
for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

create policy affiliate_portal_payout_batches_select_own
on public.affiliate_portal_payout_batches
for select
to authenticated
using ((select affiliate_portal_private.owns_payout_batch(id)));

create policy affiliate_portal_payout_batches_admin_select
on public.affiliate_portal_payout_batches
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

create policy affiliate_portal_payout_items_select_own
on public.affiliate_portal_payout_items
for select
to authenticated
using ((select affiliate_portal_private.owns_commission(commission_id)));

create policy affiliate_portal_payout_items_admin_select
on public.affiliate_portal_payout_items
for select
to authenticated
using ((select affiliate_portal_private.is_crm_admin()));

revoke all on function affiliate_portal_private.prevent_signature_mutation()
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.protect_signed_agreement()
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.protect_signed_agreement_rate()
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.create_commissions_for_paid_payment()
  from public, anon, authenticated, service_role;
revoke all on function affiliate_portal_private.owns_payout_batch(uuid)
  from public, anon, authenticated, service_role;
grant execute on function affiliate_portal_private.owns_payout_batch(uuid)
  to authenticated;

revoke all on function public.affiliate_portal_admin_send_agreement_for_signature(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_send_agreement_for_signature(uuid, uuid)
  to service_role;
revoke all on function public.affiliate_portal_admin_cancel_signature_request(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_cancel_signature_request(uuid, uuid)
  to service_role;
revoke all on function public.affiliate_portal_admin_update_agreement_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_update_agreement_status(uuid, uuid, text)
  to service_role;
revoke all on function public.affiliate_portal_sign_agreement(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_sign_agreement(uuid, uuid, text, jsonb)
  to service_role;
revoke all on function public.affiliate_portal_admin_create_payout_batch(uuid, text, date, text, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_create_payout_batch(uuid, text, date, text, uuid[])
  to service_role;
revoke all on function public.affiliate_portal_admin_update_payout_batch_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_admin_update_payout_batch_status(uuid, uuid, text)
  to service_role;
revoke all on function public.affiliate_portal_expire_signature_requests()
  from public, anon, authenticated, service_role;
grant execute on function public.affiliate_portal_expire_signature_requests()
  to service_role;

commit;
