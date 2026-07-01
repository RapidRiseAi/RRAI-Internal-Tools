begin;

-- Foolproof affiliate commission tracking on ALL payment paths + product-specific
-- rates on direct invoices.
--
-- (1) invoice_items.service_id so a direct invoice line can map to a service and
--     use that service's agreement rate (e.g. a higher % for websites).
-- (2) safety-net trigger: any invoice that becomes PAID with no payment row gets
--     one, so commission automation can never be silently skipped (covers
--     invoices marked paid at creation, direct edits, future code).
-- (3) commission trigger: add a per-invoice-line-item path (product rates) for
--     quote-less invoices, alongside the existing quote path; LIFETIME and
--     line-item-less invoices still use % of the payment amount.

alter table public.invoice_items
  add column if not exists service_id uuid references public.services(id);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items(invoice_id);
create index if not exists invoice_items_service_id_idx on public.invoice_items(service_id);

create or replace function affiliate_portal_private.ensure_payment_for_paid_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'PAID' and (tg_op = 'INSERT' or old.status is distinct from 'PAID') then
    if not exists (select 1 from public.payments where invoice_id = new.id and status = 'PAID') then
      insert into public.payments (invoice_id, amount_cents, status, method, reference, paid_at)
      values (new.id, new.amount_cents, 'PAID', 'INVOICE_MARKED_PAID', 'Auto-created when invoice marked paid', now());
    end if;
  end if;
  return new;
end
$function$;

revoke all on function affiliate_portal_private.ensure_payment_for_paid_invoice()
  from public, anon, authenticated, service_role;

drop trigger if exists affiliate_portal_ensure_payment_for_paid_invoice on public.invoices;
create trigger affiliate_portal_ensure_payment_for_paid_invoice
after insert or update of status on public.invoices
for each row execute function affiliate_portal_private.ensure_payment_for_paid_invoice();

create or replace function affiliate_portal_private.create_commissions_for_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invoice_record public.invoices%rowtype;
  quote_record public.quotes%rowtype;
  has_quote boolean := false;
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
  if not found then return new; end if;

  if invoice_record.quote_id is not null then
    select * into quote_record from public.quotes where id = invoice_record.quote_id for update;
    has_quote := found;
  end if;

  if has_quote then
    select candidate.* into referral_record from public.referrals candidate
    where (quote_record.lead_id is not null and candidate.lead_id = quote_record.lead_id)
       or (quote_record.client_id is not null and candidate.client_id = quote_record.client_id)
    order by (candidate.lead_id = quote_record.lead_id) desc, candidate.created_at limit 1;
  else
    select candidate.* into referral_record from public.referrals candidate
    where invoice_record.client_id is not null and candidate.client_id = invoice_record.client_id
    order by candidate.created_at limit 1;
  end if;
  if not found then return new; end if;

  select candidate.* into agreement from public.affiliate_portal_agreements candidate
  where candidate.affiliate_id = referral_record.affiliate_id and candidate.status = 'ACTIVE'
    and (candidate.effective_from is null or candidate.effective_from <= current_date)
    and (candidate.effective_to is null or candidate.effective_to >= current_date)
  limit 1;
  if not found then return new; end if;

  if agreement.commission_model = 'BUILD_COST' and has_quote then
    for item in
      select quote_item.id, quote_item.service_id,
        quote_item.quantity * quote_item.once_off_cents as line_base_cents
      from public.quote_items quote_item
      where quote_item.quote_id = quote_record.id and quote_item.once_off_cents > 0
    loop
      key := 'build-quote-item:' || item.id::text;
      if exists (select 1 from public.affiliate_portal_commission_snapshots where automation_key = key) then continue; end if;
      matched_rate_id := null; matched_rate_percent := null;
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
      insert into public.commissions (affiliate_id, quote_id, payment_id, status, amount_cents, commission_type)
      values (agreement.affiliate_id, quote_record.id, new.id, 'PENDING', calculated_cents, 'ONCE_OFF')
      returning id into created_commission_id;
      insert into public.affiliate_portal_commission_snapshots
        (commission_id, base_amount_cents, rate_percent, agreement_id, agreement_rate_id, service_id, commission_model, automation_key, calculation_source)
      values (created_commission_id, base_cents, applied_rate, agreement.id, matched_rate_id, item.service_id, agreement.commission_model, key, 'PAYMENT_AUTOMATION');
      insert into public.affiliate_portal_audit_events (affiliate_id, action_type, entity_type, entity_id, new_value)
      values (agreement.affiliate_id, 'automate_commission_from_payment', 'commission', created_commission_id::text,
        jsonb_build_object('payment_id', new.id, 'quote_item_id', item.id, 'agreement_id', agreement.id,
          'base_amount_cents', base_cents, 'rate_percent', applied_rate, 'amount_cents', calculated_cents,
          'commission_model', agreement.commission_model));
    end loop;
  elsif agreement.commission_model = 'BUILD_COST'
    and exists (select 1 from public.invoice_items ii where ii.invoice_id = invoice_record.id and ii.unit_amount_cents > 0) then
    for item in
      select ii.id, ii.service_id, ii.quantity * ii.unit_amount_cents as line_base_cents
      from public.invoice_items ii
      where ii.invoice_id = invoice_record.id and ii.unit_amount_cents > 0
    loop
      key := 'invoice-item:' || item.id::text;
      if exists (select 1 from public.affiliate_portal_commission_snapshots where automation_key = key) then continue; end if;
      matched_rate_id := null; matched_rate_percent := null;
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
      insert into public.commissions (affiliate_id, payment_id, status, amount_cents, commission_type)
      values (agreement.affiliate_id, new.id, 'PENDING', calculated_cents, 'ONCE_OFF')
      returning id into created_commission_id;
      insert into public.affiliate_portal_commission_snapshots
        (commission_id, base_amount_cents, rate_percent, agreement_id, agreement_rate_id, service_id, commission_model, automation_key, calculation_source)
      values (created_commission_id, base_cents, applied_rate, agreement.id, matched_rate_id, item.service_id, agreement.commission_model, key, 'PAYMENT_AUTOMATION');
      insert into public.affiliate_portal_audit_events (affiliate_id, action_type, entity_type, entity_id, new_value)
      values (agreement.affiliate_id, 'automate_commission_from_payment', 'commission', created_commission_id::text,
        jsonb_build_object('payment_id', new.id, 'invoice_item_id', item.id, 'agreement_id', agreement.id,
          'base_amount_cents', base_cents, 'rate_percent', applied_rate, 'amount_cents', calculated_cents,
          'commission_model', agreement.commission_model));
    end loop;
  else
    key := (case when agreement.commission_model = 'LIFETIME' then 'lifetime-payment:' else 'payment-amount:' end) || new.id::text;
    if agreement.default_rate_percent is null
      or exists (select 1 from public.affiliate_portal_commission_snapshots where automation_key = key) then
      return new;
    end if;
    calculated_cents := round(new.amount_cents * agreement.default_rate_percent / 100.0);
    if calculated_cents <= 0 then return new; end if;
    insert into public.commissions (affiliate_id, quote_id, payment_id, status, amount_cents, commission_type)
    values (agreement.affiliate_id, case when has_quote then quote_record.id else null end, new.id, 'PENDING', calculated_cents,
      case when agreement.commission_model = 'LIFETIME' then 'RECURRING' else 'ONCE_OFF' end)
    returning id into created_commission_id;
    insert into public.affiliate_portal_commission_snapshots
      (commission_id, base_amount_cents, rate_percent, agreement_id, service_id, commission_model, automation_key, calculation_source)
    values (created_commission_id, new.amount_cents, agreement.default_rate_percent, agreement.id, null, agreement.commission_model, key, 'PAYMENT_AUTOMATION');
    insert into public.affiliate_portal_audit_events (affiliate_id, action_type, entity_type, entity_id, new_value)
    values (agreement.affiliate_id, 'automate_commission_from_payment', 'commission', created_commission_id::text,
      jsonb_build_object('payment_id', new.id, 'agreement_id', agreement.id, 'base_amount_cents', new.amount_cents,
        'rate_percent', agreement.default_rate_percent, 'amount_cents', calculated_cents, 'commission_model', agreement.commission_model));
  end if;
  return new;
end
$function$;

commit;
