begin;

-- Aggregate click counts in SQL so the admin dashboard and the affiliate portal
-- never have to pull raw click_events rows into the app just to count them.
-- Previously the admin loaded up to 5,000 click rows and the portal links page
-- loaded every click for the affiliate, both counting in JS. These views return
-- one small row per affiliate / per tracking link instead.
--
-- security_invoker = true: the view runs with the querying role's privileges
-- (both consumers use the service role), so it neither bypasses RLS nor trips the
-- "security definer view" advisor. Access is restricted to service_role.

create or replace view public.affiliate_portal_affiliate_click_stats
with (security_invoker = true) as
select
  affiliate_id,
  count(*)::int as clicks_total,
  count(*) filter (where occurred_at >= now() - interval '30 days')::int as clicks_30d
from public.affiliate_portal_click_events
where affiliate_id is not null
group by affiliate_id;

create or replace view public.affiliate_portal_tracking_link_click_stats
with (security_invoker = true) as
select
  tracking_link_id,
  count(*)::int as clicks_total
from public.affiliate_portal_click_events
where tracking_link_id is not null
group by tracking_link_id;

revoke all on public.affiliate_portal_affiliate_click_stats from anon, authenticated;
revoke all on public.affiliate_portal_tracking_link_click_stats from anon, authenticated;
grant select on public.affiliate_portal_affiliate_click_stats to service_role;
grant select on public.affiliate_portal_tracking_link_click_stats to service_role;

commit;
