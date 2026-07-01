begin;

-- Turn any WhatsApp/email/phone click into a CRM lead so contact attempts are
-- never lost (form submissions already did this; clicks did not unless the
-- visitor arrived via an affiliate link). Deduped to one lead per
-- session+channel+day. Affiliate attribution is applied when a valid code is
-- present; anonymous visitors still create a visible lead. service_role only.

create or replace function public.submit_website_contact_intent(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session text := nullif(btrim(p_payload->>'session_id'), '');
  v_channel text := lower(nullif(btrim(p_payload->>'channel'), ''));
  v_code    text := nullif(btrim(p_payload->>'code'), '');
  v_token   text := nullif(btrim(p_payload->>'tracking_token'), '');
  v_service text := coalesce(nullif(btrim(p_payload->>'service_hint'), ''), 'Unknown');
  v_page    text := nullif(btrim(p_payload->>'page_path'), '');
  v_link    text := nullif(btrim(p_payload->>'link_url'), '');
  v_key text;
  v_lead_id uuid;
  v_affiliate_id uuid;
  v_session_uuid uuid;
begin
  if v_session is null or v_channel not in ('whatsapp', 'email', 'phone') then
    return jsonb_build_object('ok', false, 'reason', 'missing_input');
  end if;

  if v_code is not null then
    begin
      perform public.record_website_referral_click(jsonb_build_object(
        'code', v_code, 'session_id', v_session, 'tracking_token', v_token,
        'landing_page', v_page, 'referrer', v_link));
      select id into v_affiliate_id
        from public.affiliates where tracking_code = v_code and status = 'ACTIVE';
    exception when others then
      v_affiliate_id := null;
    end;
  end if;

  v_key := 'website:contact-intent:' || v_session || ':' || v_channel || ':' || to_char(now(), 'YYYY-MM-DD');
  insert into public.form_submissions (submission_key, action)
    values (v_key, 'website:contact_intent')
  on conflict (submission_key) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  insert into public.leads
    (company_name, contact_name, source, service_interest, stage, next_action, pain_points)
  values (
    'Website ' || initcap(v_channel) || ' enquiry',
    'Unknown website visitor',
    'Website ' || initcap(v_channel) || ' Click',
    v_service,
    'NEW_LEAD',
    'Await inbound ' || v_channel || ' message; capture contact details',
    array_to_string(array_remove(array[
      case when v_code is not null then 'Affiliate code: ' || v_code end,
      case when v_token is not null then 'Campaign token: ' || v_token end,
      'Channel: ' || v_channel,
      case when v_page is not null then 'Page: ' || v_page end,
      case when v_link is not null then 'Clicked link: ' || v_link end
    ], null), E'\n')
  )
  returning id into v_lead_id;

  if v_affiliate_id is not null then
    begin
      v_session_uuid := v_session::uuid;
      perform public.affiliate_portal_record_tracked_referral(v_lead_id, v_session_uuid);
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false);
end
$function$;

revoke all on function public.submit_website_contact_intent(jsonb) from public, anon, authenticated;
grant execute on function public.submit_website_contact_intent(jsonb) to service_role;

commit;
