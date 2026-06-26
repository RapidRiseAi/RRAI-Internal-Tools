create or replace function public.record_website_referral_click(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code text := nullif(btrim(p_payload->>'code'), '');
  v_session_id uuid := nullif(p_payload->>'session_id', '')::uuid;
  v_tracking_token text := nullif(btrim(p_payload->>'tracking_token'), '');
  v_affiliate_id uuid;
  v_tracking_link_id uuid;
  v_window interval := interval '90 days';
begin
  if v_code is null or v_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_input');
  end if;

  select id into v_affiliate_id
  from public.affiliates
  where tracking_code = v_code and status = 'ACTIVE';

  if v_affiliate_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_affiliate');
  end if;

  if v_tracking_token is not null then
    select id into v_tracking_link_id
    from public.affiliate_portal_tracking_links
    where affiliate_id = v_affiliate_id
      and tracking_token = v_tracking_token
      and is_active = true
      and (expires_at is null or expires_at > now());

    if v_tracking_link_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_tracking_link');
    end if;
  end if;

  insert into public.affiliate_portal_referral_sessions as sess
    (session_id, affiliate_id, tracking_link_id, first_click_at, last_click_at, attribution_expires_at)
  values
    (v_session_id, v_affiliate_id, v_tracking_link_id, now(), now(), now() + v_window)
  on conflict (session_id) do update
    set affiliate_id = coalesce(sess.affiliate_id, excluded.affiliate_id),
        tracking_link_id = coalesce(excluded.tracking_link_id, sess.tracking_link_id),
        last_click_at = now(),
        attribution_expires_at = greatest(sess.attribution_expires_at, now() + v_window),
        updated_at = now();

  insert into public.affiliate_portal_click_events
    (tracking_link_id, session_id, affiliate_id, occurred_at, landing_page, referrer)
  values
    (v_tracking_link_id, v_session_id, v_affiliate_id, now(),
     left(nullif(btrim(p_payload->>'landing_page'), ''), 300),
     left(nullif(btrim(p_payload->>'referrer'), ''), 500));

  return jsonb_build_object('ok', true, 'tracking_link_id', v_tracking_link_id);
end
$function$;

create or replace function public.submit_website_lead(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sub      text  := nullif(btrim(p_payload->>'submission_id'), '');
  v_lead     jsonb := coalesce(p_payload->'lead', '{}'::jsonb);
  v_aff      jsonb := coalesce(p_payload->'affiliate', '{}'::jsonb);
  v_name     text  := nullif(btrim(v_lead->>'name'), '');
  v_business text  := nullif(btrim(v_lead->>'business'), '');
  v_service  text  := nullif(btrim(v_lead->>'service'), '');
  v_lead_id  uuid;
  v_session_id uuid;
begin
  if v_sub is null or v_name is null or v_service is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_required_fields');
  end if;

  insert into public.form_submissions (submission_key, action)
    values (v_sub, 'website:lead')
  on conflict (submission_key) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  insert into public.leads
    (company_name, contact_name, email, phone, source, service_interest, stage, pain_points)
  values
    (coalesce(v_business, v_name),
     v_name,
     nullif(btrim(v_lead->>'email'), ''),
     nullif(btrim(v_lead->>'phone'), ''),
     'Website Contact Form',
     v_service,
     'NEW_LEAD',
     array_to_string(array_remove(array[
       nullif(btrim(v_lead->>'details'), ''),
       case when nullif(btrim(v_lead->>'budget'), '') is not null
            then 'Budget: ' || btrim(v_lead->>'budget') end,
       case when nullif(btrim(v_lead->>'timeline'), '') is not null
            then 'Timeline: ' || btrim(v_lead->>'timeline') end,
       case when nullif(btrim(v_lead->>'website'), '') is not null
            then 'Existing website: ' || btrim(v_lead->>'website') end,
       case when nullif(btrim(v_lead->>'preferred_contact'), '') is not null
            then 'Preferred contact: ' || btrim(v_lead->>'preferred_contact') end,
       case when nullif(btrim(v_aff->>'tracking_token'), '') is not null
            then 'Affiliate campaign token: ' || btrim(v_aff->>'tracking_token') end
     ], null), E'\n'))
  returning id into v_lead_id;

  if nullif(v_aff->>'code', '') is not null and nullif(v_aff->>'session_id', '') is not null then
    begin
      perform public.record_website_referral_click(jsonb_build_object(
        'code', v_aff->>'code',
        'session_id', v_aff->>'session_id',
        'tracking_token', v_aff->>'tracking_token',
        'landing_page', p_payload #>> '{context,page_path}',
        'referrer', p_payload #>> '{context,submitted_from}'
      ));
      v_session_id := nullif(v_aff->>'session_id', '')::uuid;
      perform public.affiliate_portal_record_tracked_referral(v_lead_id, v_session_id);
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false);
end
$function$;

create or replace function public.record_website_referral_intent(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code text := nullif(btrim(p_payload->>'code'), '');
  v_session_id uuid := nullif(p_payload->>'session_id', '')::uuid;
  v_tracking_token text := nullif(btrim(p_payload->>'tracking_token'), '');
  v_channel text := lower(nullif(btrim(p_payload->>'channel'), ''));
  v_service text := coalesce(nullif(btrim(p_payload->>'service_hint'), ''), 'Unknown');
  v_submission_key text;
  v_lead_id uuid;
begin
  if v_code is null or v_session_id is null or v_channel not in ('whatsapp', 'email', 'phone') then
    return jsonb_build_object('ok', false, 'reason', 'missing_input');
  end if;

  perform public.record_website_referral_click(jsonb_build_object(
    'code', v_code,
    'session_id', v_session_id::text,
    'tracking_token', v_tracking_token,
    'landing_page', p_payload->>'page_path',
    'referrer', p_payload->>'page_url'
  ));

  v_submission_key := 'website:intent:' || v_session_id::text || ':' || v_channel;
  insert into public.form_submissions (submission_key, action)
    values (v_submission_key, 'website:affiliate_intent')
  on conflict (submission_key) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  insert into public.leads
    (company_name, contact_name, source, service_interest, stage, next_action, pain_points)
  values
    ('Draft affiliate ' || initcap(v_channel) || ' enquiry',
     'Unknown website visitor',
     'Website Affiliate ' || initcap(v_channel) || ' Click',
     v_service,
     'NEW_LEAD',
     'Complete lead details from attributed ' || initcap(v_channel) || ' click',
     array_to_string(array_remove(array[
       'Affiliate code: ' || v_code,
       case when v_tracking_token is not null then 'Campaign token: ' || v_tracking_token end,
       'Clicked channel: ' || v_channel,
       case when nullif(btrim(p_payload->>'page_path'), '') is not null then 'Page: ' || btrim(p_payload->>'page_path') end,
       case when nullif(btrim(p_payload->>'link_url'), '') is not null then 'Clicked link: ' || btrim(p_payload->>'link_url') end
     ], null), E'\n'))
  returning id into v_lead_id;

  begin
    perform public.affiliate_portal_record_tracked_referral(v_lead_id, v_session_id);
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false);
end
$function$;

revoke all on function public.record_website_referral_click(jsonb) from public, anon, authenticated;
revoke all on function public.submit_website_lead(jsonb) from public, anon, authenticated;
revoke all on function public.record_website_referral_intent(jsonb) from public, anon, authenticated;
grant execute on function public.record_website_referral_click(jsonb) to service_role;
grant execute on function public.submit_website_lead(jsonb) to service_role;
grant execute on function public.record_website_referral_intent(jsonb) to service_role;
