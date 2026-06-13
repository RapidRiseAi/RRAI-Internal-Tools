-- Atomic workflow conversions for lead/client and quote/project/billing handoffs.

create or replace function public.convert_lead_to_client_atomic(
  p_lead_id uuid,
  p_actor_id uuid default null
)
returns table (client_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_client_id uuid;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  if v_lead.converted_client_id is not null then
    client_id := v_lead.converted_client_id;
    return next;
    return;
  end if;

  insert into public.clients (company_name, primary_email, primary_phone, next_action)
  values (v_lead.company_name, v_lead.email, v_lead.phone, 'Complete client onboarding and create first project.')
  returning id into v_client_id;

  insert into public.contacts (client_id, name, email, phone, is_primary)
  values (v_client_id, v_lead.contact_name, v_lead.email, v_lead.phone, true);

  update public.leads
  set stage = 'WON', converted_client_id = v_client_id, updated_at = now()
  where id = p_lead_id;

  insert into public.activity_logs (action, entity_type, entity_id, message, actor_id, lead_id, client_id)
  values ('LEAD_CONVERTED_TO_CLIENT', 'Client', v_client_id, v_lead.company_name || ' converted to client', p_actor_id, p_lead_id, v_client_id);

  client_id := v_client_id;
  return next;
end;
$$;

create or replace function public.accept_quote_atomic(
  p_quote_id uuid,
  p_actor_id uuid default null,
  p_invoice_number text default null
)
returns table (
  client_id uuid,
  project_id uuid,
  invoice_id uuid,
  retainer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_lead public.leads%rowtype;
  v_client_id uuid;
  v_project_id uuid;
  v_existing_project_id uuid;
  v_invoice_id uuid;
  v_retainer_id uuid;
  v_invoice_number text;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote % not found', p_quote_id using errcode = 'P0002';
  end if;

  v_client_id := v_quote.client_id;

  if v_client_id is null and v_quote.lead_id is not null then
    select * into v_lead
    from public.leads
    where id = v_quote.lead_id
    for update;

    if not found then
      raise exception 'Lead % linked to quote % not found', v_quote.lead_id, p_quote_id using errcode = 'P0002';
    end if;

    if v_lead.converted_client_id is not null then
      v_client_id := v_lead.converted_client_id;
    else
      insert into public.clients (company_name, primary_email, primary_phone, next_action)
      values (v_lead.company_name, v_lead.email, v_lead.phone, 'Accepted quote: confirm onboarding and kickoff.')
      returning id into v_client_id;

      insert into public.contacts (client_id, name, email, phone, is_primary)
      values (v_client_id, v_lead.contact_name, v_lead.email, v_lead.phone, true);

      update public.leads
      set stage = 'WON', converted_client_id = v_client_id, updated_at = now()
      where id = v_quote.lead_id;
    end if;

    update public.quotes
    set client_id = v_client_id, updated_at = now()
    where id = p_quote_id;
  end if;

  if v_client_id is null then
    raise exception 'A quote must be linked to a client or lead before acceptance.' using errcode = 'P0001';
  end if;

  update public.quotes
  set status = 'ACCEPTED', accepted_at = coalesce(accepted_at, now()), client_id = v_client_id, updated_at = now()
  where id = p_quote_id;

  select id into v_existing_project_id
  from public.projects
  where quote_id = p_quote_id
  order by created_at
  limit 1
  for update;

  if v_existing_project_id is null then
    insert into public.projects (client_id, quote_id, name, status, stage, priority, progress)
    values (v_client_id, p_quote_id, v_quote.title, 'NOT_STARTED', 'Kickoff', 'MEDIUM', 0)
    returning id into v_project_id;

    insert into public.project_checklists (project_id, template_item_id, title, status)
    select v_project_id, checklist_items.id, checklist_items.title, 'TO_DO'
    from public.checklist_items
    order by checklist_items.sort_order
    limit 12;

    if not found then
      insert into public.project_checklists (project_id, title, status)
      values
        (v_project_id, 'Confirm project scope and success criteria', 'TO_DO'),
        (v_project_id, 'Collect client content, access and brand assets', 'TO_DO'),
        (v_project_id, 'Complete build and internal QA', 'TO_DO'),
        (v_project_id, 'Client review, revisions and launch handover', 'TO_DO');
    end if;

    if v_quote.once_off_total_cents > 0 then
      v_invoice_number := coalesce(nullif(p_invoice_number, ''), 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)));

      insert into public.invoices (client_id, quote_id, invoice_number, status, amount_cents, issued_at, due_date)
      values (v_client_id, p_quote_id, v_invoice_number, 'SENT', v_quote.once_off_total_cents, now(), (now() + interval '7 days')::date)
      returning id into v_invoice_id;
    end if;

    if v_quote.monthly_total_cents > 0 then
      insert into public.retainers (client_id, type, status, monthly_amount_cents, next_billing_date)
      values (v_client_id, v_quote.title || ' retainer', 'ACTIVE', v_quote.monthly_total_cents, (now() + interval '30 days')::date)
      returning id into v_retainer_id;
    end if;
  else
    v_project_id := v_existing_project_id;
  end if;

  insert into public.activity_logs (action, entity_type, entity_id, message, actor_id, lead_id, client_id, quote_id, project_id)
  values ('QUOTE_ACCEPTED', 'Quote', p_quote_id, v_quote.title || ' accepted; project, checklist and finance records created', p_actor_id, v_quote.lead_id, v_client_id, p_quote_id, v_project_id);

  client_id := v_client_id;
  project_id := v_project_id;
  invoice_id := v_invoice_id;
  retainer_id := v_retainer_id;
  return next;
end;
$$;

grant execute on function public.convert_lead_to_client_atomic(uuid, uuid) to authenticated, service_role;
grant execute on function public.accept_quote_atomic(uuid, uuid, text) to authenticated, service_role;
