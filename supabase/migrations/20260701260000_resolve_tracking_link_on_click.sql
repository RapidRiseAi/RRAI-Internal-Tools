begin;

-- ---------------------------------------------------------------------------
-- Resolve the per-campaign / per-person tracking link on every referral click.
--
-- Affiliates create tracking links (a unique tracking_token + a private_reference
-- like a person's name + private notes) and share /r/<code>/<token>. That token
-- was passed all the way to record_website_referral_click but NEVER resolved to a
-- tracking_link_id, so:
--   * affiliate_portal_referral_sessions.tracking_link_id stayed null,
--   * affiliate_portal_record_tracked_referral copied that null onto the
--     attribution, so the portal referral page could never show WHICH link a
--     referral came from (it always fell back to "Website referral"), and
--   * affiliate_portal_click_events.tracking_link_id stayed null, so per-link
--     click counts were always 0.
--
-- This resolves the token -> tracking link (by tracking_token or custom_alias for
-- that affiliate) and stamps it on both the session and the click event, so the
-- referral is traceable back to the exact link/reference/notes end-to-end.
-- ---------------------------------------------------------------------------
create or replace function public.record_website_referral_click(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code         text := nullif(btrim(p_payload->>'code'), '');
  v_token        text := nullif(btrim(p_payload->>'tracking_token'), '');
  v_session_id   uuid;
  v_affiliate_id uuid;
  v_link_id      uuid;
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

  -- Resolve the specific campaign link from its token (matches tracking_token or
  -- a custom alias) so the referral can be traced to the affiliate's private
  -- reference + notes, and per-link click counts work.
  if v_token is not null then
    select id into v_link_id
    from public.affiliate_portal_tracking_links
    where affiliate_id = v_affiliate_id
      and (tracking_token = v_token or custom_alias = v_token)
    limit 1;
  end if;

  insert into public.affiliate_portal_referral_sessions as sess
    (session_id, affiliate_id, tracking_link_id, first_click_at, last_click_at, attribution_expires_at)
  values
    (v_session_id, v_affiliate_id, v_link_id, now(), now(), now() + v_window)
  on conflict (session_id) do update
    set last_click_at          = now(),
        affiliate_id           = coalesce(sess.affiliate_id, excluded.affiliate_id),
        tracking_link_id       = coalesce(sess.tracking_link_id, excluded.tracking_link_id),
        attribution_expires_at = greatest(sess.attribution_expires_at, excluded.attribution_expires_at),
        updated_at             = now();

  insert into public.affiliate_portal_click_events
    (session_id, affiliate_id, tracking_link_id, occurred_at, landing_page, referrer)
  values
    (v_session_id, v_affiliate_id, v_link_id, now(),
     left(nullif(btrim(p_payload->>'landing_page'), ''), 500),
     left(nullif(btrim(p_payload->>'referrer'), ''), 500));

  return jsonb_build_object('ok', true);
end;
$function$;

commit;
