begin;

-- ---------------------------------------------------------------------------
-- Website contact-intent attribution reliability.
--
-- Symptom: a visitor used the email method from an affiliate link, the email was
-- sent, but nothing appeared on the affiliate's referral page. Root cause was a
-- combination of (a) the client intermittently posting the intent with code=null
-- and (b) this RPC SILENTLY swallowing every attribution failure and still
-- returning ok=true, so a lost attribution was invisible and undiagnosable.
--
-- This migration makes the server side robust and, above all, OBSERVABLE:
--   * validate the session id up front instead of hiding a failed ::uuid cast;
--   * match tracking_code case-insensitively (a case-drifted code no longer
--     silently misses);
--   * include the affiliate code in the per-day dedup key, so a correctly-coded
--     contact can never be deduped away by an earlier anonymous one;
--   * NEVER swallow an attribution failure — record it to the audit log with the
--     SQLSTATE/SQLERRM and return an explicit `attribution` reason, so any miss
--     is visible instead of a silent ok=true;
--   * align the server attribution window (was 30d) with the 90-day client TTL.
-- Also adds a UNIQUE(lead_id) guard so one-referral-per-lead is enforced by the DB.
-- ---------------------------------------------------------------------------

-- One referral per lead, enforced by the database (was only a soft in-function
-- SELECT). Partial: direct-client referrals may have a null lead_id.
create unique index if not exists referrals_lead_id_unique
  on public.referrals (lead_id) where lead_id is not null;

-- Case-insensitive code match + 90-day window aligned with the client TTL.
create or replace function public.record_website_referral_click(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code         text := nullif(btrim(p_payload->>'code'), '');
  v_session_id   uuid;
  v_affiliate_id uuid;
  v_window       interval := interval '90 days';
begin
  begin
    v_session_id := nullif(btrim(p_payload->>'session_id'), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'bad_session');
  end;

  if v_code is null or v_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_input');
  end if;

  select id into v_affiliate_id
  from public.affiliates
  where lower(tracking_code) = lower(v_code) and status = 'ACTIVE';

  if v_affiliate_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  insert into public.affiliate_portal_referral_sessions as sess
    (session_id, affiliate_id, first_click_at, last_click_at, attribution_expires_at)
  values
    (v_session_id, v_affiliate_id, now(), now(), now() + v_window)
  on conflict (session_id) do update
    set last_click_at          = now(),
        affiliate_id           = coalesce(sess.affiliate_id, excluded.affiliate_id),
        attribution_expires_at = greatest(sess.attribution_expires_at, excluded.attribution_expires_at),
        updated_at             = now();

  insert into public.affiliate_portal_click_events
    (session_id, affiliate_id, occurred_at, landing_page, referrer)
  values
    (v_session_id, v_affiliate_id, now(),
     left(nullif(btrim(p_payload->>'landing_page'), ''), 500),
     left(nullif(btrim(p_payload->>'referrer'), ''), 500));

  return jsonb_build_object('ok', true);
end;
$function$;

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
  v_session_valid boolean := false;
  v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if v_session is null or v_channel not in ('whatsapp', 'email', 'phone') then
    return jsonb_build_object('ok', false, 'reason', 'missing_input');
  end if;

  -- Validate the session id up front (do NOT hide a failed cast in a swallow).
  if v_session ~ v_uuid_re then
    v_session_uuid := v_session::uuid;
    v_session_valid := true;
  end if;

  -- Record the click/session for a coded visitor (best-effort, but audited on failure).
  if v_code is not null and v_session_valid then
    begin
      perform public.record_website_referral_click(jsonb_build_object(
        'code', v_code, 'session_id', v_session, 'tracking_token', v_token,
        'landing_page', v_page, 'referrer', v_link));
    exception when others then
      insert into public.affiliate_portal_audit_events (action_type, entity_type, entity_id, new_value)
      values ('website_referral_click_failed', 'website_intent', v_session,
        jsonb_build_object('sqlstate', sqlstate, 'error', sqlerrm, 'code', v_code));
    end;
  end if;

  -- One lead per visitor session + channel + affiliate-code + day. Including the
  -- code guarantees a correctly-coded contact is never deduped away by an earlier
  -- anonymous click in the same session/channel/day.
  v_key := 'website:contact-intent:' || v_session || ':' || v_channel || ':'
        || coalesce(v_code, 'anon') || ':' || to_char(now(), 'YYYY-MM-DD');
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

  -- No affiliate code at all: an ordinary anonymous website lead.
  if v_code is null then
    return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false, 'attribution', 'anonymous');
  end if;

  -- Code present but the session id was not a valid UUID: attribution cannot be
  -- keyed. Record it so the miss is visible rather than silent.
  if not v_session_valid then
    insert into public.affiliate_portal_audit_events (action_type, entity_type, entity_id, new_value)
    values ('website_attribution_failed', 'lead', v_lead_id::text,
      jsonb_build_object('reason', 'bad_session', 'session_id', v_session, 'code', v_code, 'channel', v_channel));
    return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false, 'attribution', 'bad_session');
  end if;

  select id into v_affiliate_id
    from public.affiliates where lower(tracking_code) = lower(v_code) and status = 'ACTIVE';

  -- Code present but no ACTIVE affiliate matches (unknown code, case drift, or a
  -- paused affiliate). Record it so it can be reconciled instead of vanishing.
  if v_affiliate_id is null then
    insert into public.affiliate_portal_audit_events (action_type, entity_type, entity_id, new_value)
    values ('website_attribution_unknown_code', 'lead', v_lead_id::text,
      jsonb_build_object('reason', 'unknown_or_inactive_code', 'code', v_code, 'channel', v_channel));
    return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false, 'attribution', 'unknown_code');
  end if;

  -- Link the lead to the affiliate. Only a genuine "already attributed" (23505)
  -- is benign; ANY other failure is recorded (never swallowed) and returned.
  begin
    perform public.affiliate_portal_record_tracked_referral(v_lead_id, v_session_uuid);
  exception
    when sqlstate '23505' then
      return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false, 'attribution', 'already_linked');
    when others then
      insert into public.affiliate_portal_audit_events (affiliate_id, action_type, entity_type, entity_id, new_value)
      values (v_affiliate_id, 'website_attribution_failed', 'lead', v_lead_id::text,
        jsonb_build_object('sqlstate', sqlstate, 'error', sqlerrm, 'code', v_code,
          'session_id', v_session, 'channel', v_channel));
      return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false,
        'attribution', 'failed', 'reason', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'deduped', false, 'attribution', 'linked');
end
$function$;

commit;
