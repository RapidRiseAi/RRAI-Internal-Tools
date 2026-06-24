begin;

create index affiliate_portal_agreements_signature_requester_idx
  on public.affiliate_portal_agreements (signature_requested_by_crm_user_id);
create index payments_invoice_id_idx
  on public.payments (invoice_id);

drop policy affiliate_portal_agreement_signatures_select_own
  on public.affiliate_portal_agreement_signatures;
drop policy affiliate_portal_agreement_signatures_admin_select
  on public.affiliate_portal_agreement_signatures;
create policy affiliate_portal_agreement_signatures_select_authorized
on public.affiliate_portal_agreement_signatures
for select
to authenticated
using (
  (select affiliate_portal_private.owns_agreement(agreement_id))
  or (select affiliate_portal_private.is_crm_admin())
);

drop policy affiliate_portal_payout_batches_select_own
  on public.affiliate_portal_payout_batches;
drop policy affiliate_portal_payout_batches_admin_select
  on public.affiliate_portal_payout_batches;
create policy affiliate_portal_payout_batches_select_authorized
on public.affiliate_portal_payout_batches
for select
to authenticated
using (
  (select affiliate_portal_private.owns_payout_batch(id))
  or (select affiliate_portal_private.is_crm_admin())
);

drop policy affiliate_portal_payout_items_select_own
  on public.affiliate_portal_payout_items;
drop policy affiliate_portal_payout_items_admin_select
  on public.affiliate_portal_payout_items;
create policy affiliate_portal_payout_items_select_authorized
on public.affiliate_portal_payout_items
for select
to authenticated
using (
  (select affiliate_portal_private.owns_commission(commission_id))
  or (select affiliate_portal_private.is_crm_admin())
);

revoke all on table public.affiliate_portal_agreement_signatures from service_role;
revoke all on table public.affiliate_portal_notification_preferences from service_role;
revoke all on table public.affiliate_portal_payout_batches from service_role;
revoke all on table public.affiliate_portal_payout_items from service_role;
grant select on table public.affiliate_portal_agreement_signatures to service_role;
grant select on table public.affiliate_portal_notification_preferences to service_role;
grant select on table public.affiliate_portal_payout_batches to service_role;
grant select on table public.affiliate_portal_payout_items to service_role;

commit;
