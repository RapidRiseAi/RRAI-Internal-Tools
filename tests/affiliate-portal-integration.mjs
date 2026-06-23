import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  adminRole: "10000000-0000-4000-8000-000000000001",
  staffRole: "10000000-0000-4000-8000-000000000002",
  admin: "20000000-0000-4000-8000-000000000001",
  staff: "20000000-0000-4000-8000-000000000002",
  verifiedApplicant: "30000000-0000-4000-8000-000000000001",
  unverifiedApplicant: "30000000-0000-4000-8000-000000000002",
  declinedApplicant: "30000000-0000-4000-8000-000000000003",
  unrelatedApplicant: "30000000-0000-4000-8000-000000000004",
  affiliate: "40000000-0000-4000-8000-000000000001",
  verifiedApplication: "50000000-0000-4000-8000-000000000001",
  unverifiedApplication: "50000000-0000-4000-8000-000000000002",
  declinedApplication: "50000000-0000-4000-8000-000000000003",
  lead: "60000000-0000-4000-8000-000000000001",
  quote: "70000000-0000-4000-8000-000000000001",
  project: "70000000-0000-4000-8000-000000000002",
  service: "80000000-0000-4000-8000-000000000001",
};

const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema affiliate_portal_private;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function affiliate_portal_private.set_updated_at()
  returns trigger language plpgsql set search_path = '' as $$
  begin new.updated_at = now(); return new; end $$;

  create table auth.users (
    id uuid primary key,
    email text,
    email_confirmed_at timestamptz
  );
  create table public.roles (
    id uuid primary key,
    name text not null,
    permissions jsonb not null default '[]'::jsonb
  );
  create table public.users (
    id uuid primary key,
    role_id uuid not null references public.roles(id),
    status text not null,
    name text not null,
    email text not null
  );
  create table public.affiliates (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    tracking_code text not null unique,
    status text not null default 'ACTIVE',
    default_commission_type text not null default 'ONCE_OFF',
    default_commission_rate integer not null default 10,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.leads (id uuid primary key);
  create table public.quotes (id uuid primary key);
  create table public.projects (id uuid primary key);
  create table public.payments (id uuid primary key);
  create table public.services (
    id uuid primary key,
    name text not null,
    category text not null,
    description text not null default '',
    base_once_off_cents integer not null default 0,
    base_monthly_cents integer not null default 0,
    is_active boolean not null default true
  );
  create table public.referrals (
    id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references public.affiliates(id),
    lead_id uuid references public.leads(id),
    client_id uuid,
    status text not null default 'PENDING',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.commissions (
    id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references public.affiliates(id),
    quote_id uuid references public.quotes(id),
    project_id uuid references public.projects(id),
    payment_id uuid references public.payments(id),
    status text not null default 'PENDING',
    amount_cents integer not null,
    commission_type text not null default 'ONCE_OFF',
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create type public.affiliate_portal_application_status as enum (
    'pending_review', 'approved', 'declined', 'deleted_or_anonymised'
  );
  create table public.affiliate_portal_partner_applications (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    first_name text not null,
    surname text not null,
    business_name text not null,
    email text not null,
    phone text not null,
    client_types text not null,
    motivation text not null,
    status public.affiliate_portal_application_status not null default 'pending_review',
    rejection_reason text,
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by_crm_user_id uuid references public.users(id),
    deletion_scheduled_at timestamptz,
    terms_accepted_at timestamptz not null,
    internal_notes text,
    updated_at timestamptz not null default now()
  );
  create table public.affiliate_portal_user_links (
    auth_user_id uuid primary key references auth.users(id) on delete cascade,
    affiliate_id uuid unique references public.affiliates(id),
    crm_user_id uuid unique references public.users(id),
    created_by_auth_user_id uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.affiliate_portal_lead_attributions (
    id uuid primary key default gen_random_uuid(),
    crm_referral_id uuid not null unique references public.referrals(id),
    tracking_link_id uuid,
    referral_session_id uuid,
    attribution_source text not null,
    manual_attribution_reason text,
    attributed_by_crm_user_id uuid references public.users(id),
    fraud_flag boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.affiliate_portal_commission_snapshots (
    commission_id uuid primary key references public.commissions(id),
    base_amount_cents integer not null,
    rate_percent numeric(7,4) not null,
    created_by_crm_user_id uuid references public.users(id),
    created_at timestamptz not null default now()
  );
  create table public.affiliate_portal_audit_events (
    id uuid primary key default gen_random_uuid(),
    actor_auth_user_id uuid,
    actor_crm_user_id uuid references public.users(id),
    affiliate_id uuid references public.affiliates(id),
    action_type text not null,
    entity_type text not null,
    entity_id text not null,
    old_value jsonb,
    new_value jsonb,
    occurred_at timestamptz not null default now()
  );

  insert into public.roles (id,name,permissions) values
    ('${ids.adminRole}','Owner/Admin','["settings:manage"]'),
    ('${ids.staffRole}','Staff','["marketing:read"]');
  insert into public.users (id,role_id,status,name,email) values
    ('${ids.admin}','${ids.adminRole}','ACTIVE','CRM Admin','admin@example.com'),
    ('${ids.staff}','${ids.staffRole}','ACTIVE','Staff','staff@example.com');
  insert into auth.users (id,email,email_confirmed_at) values
    ('${ids.verifiedApplicant}','verified@example.com',now()),
    ('${ids.unverifiedApplicant}','unverified@example.com',null),
    ('${ids.declinedApplicant}','decline@example.com',now());
  insert into auth.users (id,email,email_confirmed_at) values
    ('${ids.unrelatedApplicant}','unrelated@example.com',now());
  insert into public.affiliates (id,name,email,tracking_code) values
    ('${ids.affiliate}','Existing Affiliate','existing@example.com','existing-affiliate');
  insert into public.affiliate_portal_partner_applications (
    id,auth_user_id,first_name,surname,business_name,email,phone,
    client_types,motivation,terms_accepted_at
  ) values
    ('${ids.verifiedApplication}','${ids.verifiedApplicant}','Verified','Applicant','Verified Co','verified@example.com','123','SMB','Partner',now()),
    ('${ids.unverifiedApplication}','${ids.unverifiedApplicant}','Unverified','Applicant','Unverified Co','unverified@example.com','123','SMB','Partner',now()),
    ('${ids.declinedApplication}','${ids.declinedApplicant}','Decline','Applicant','Decline Co','decline@example.com','123','SMB','Partner',now());
  insert into public.leads (id) values ('${ids.lead}');
  insert into public.quotes (id) values ('${ids.quote}');
  insert into public.projects (id) values ('${ids.project}');
  insert into public.services (id,name,category) values ('${ids.service}','Website Build','WEB');
`);

const migration = await readFile(
  new URL("../supabase/migrations/20260623130138_affiliate_portal_internal_admin.sql", import.meta.url),
  "utf8",
);
await db.exec(migration);

async function asService(sql, params = []) {
  await db.exec("begin");
  try {
    await db.exec("set local role service_role");
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function asAuthenticated(authUserId, sql, params = []) {
  await db.exec("begin");
  try {
    await db.exec("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [authUserId]);
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

const privileges = (await db.query(`
  select
    has_function_privilege('service_role','public.affiliate_portal_admin_approve_application(uuid,uuid,text,uuid,text)','execute') as service_can_approve,
    has_function_privilege('authenticated','public.affiliate_portal_admin_approve_application(uuid,uuid,text,uuid,text)','execute') as authenticated_can_approve,
    has_function_privilege('anon','public.affiliate_portal_admin_approve_application(uuid,uuid,text,uuid,text)','execute') as anon_can_approve,
    has_function_privilege('service_role','public.affiliate_portal_admin_create_agreement_commission(uuid,uuid,uuid,uuid,uuid,uuid,text,integer)','execute') as service_can_create_agreement_commission,
    has_function_privilege('service_role','public.affiliate_portal_admin_create_commission(uuid,uuid,uuid,uuid,uuid,text,text,integer,numeric)','execute') as legacy_commission_disabled
`)).rows[0];
assert.deepEqual(privileges, {
  service_can_approve: true,
  authenticated_can_approve: false,
  anon_can_approve: false,
  service_can_create_agreement_commission: true,
  legacy_commission_disabled: false,
});

await assert.rejects(() => asService(
  "select * from public.affiliate_portal_admin_approve_application($1,$2,'link',$3,null)",
  [ids.staff, ids.verifiedApplication, ids.affiliate],
));

const approval = await asService(
  "select * from public.affiliate_portal_admin_approve_application($1,$2,'link',$3,null)",
  [ids.admin, ids.verifiedApplication, ids.affiliate],
);
assert.deepEqual(approval, [{ affiliate_id: ids.affiliate, tracking_code: "existing-affiliate" }]);

await assert.rejects(() => asService(
  "select * from public.affiliate_portal_admin_approve_application($1,$2,'create',null,'unverified-new')",
  [ids.admin, ids.unverifiedApplication],
));

await asService(
  "select public.affiliate_portal_admin_decline_application($1,$2,$3)",
  [ids.admin, ids.declinedApplication, "Not a fit"],
);
const decline = (await db.query(`
  select status::text, deletion_scheduled_at > now() + interval '47 hours' as scheduled
  from public.affiliate_portal_partner_applications
  where id='${ids.declinedApplication}'
`)).rows[0];
assert.deepEqual(decline, { status: "declined", scheduled: true });

const referral = await asService(
  "select * from public.affiliate_portal_admin_record_manual_referral($1,$2,$3,$4)",
  [ids.admin, ids.lead, ids.affiliate, "Confirmed by sales"],
);
assert.equal(referral.length, 1);
assert.equal((await db.query("select count(*)::int as count from public.affiliate_portal_lead_attributions")).rows[0].count, 1);

await assert.rejects(() => asService(
  "select public.affiliate_portal_admin_save_agreement($1,null,$2,'BUILD_COST',51,'DRAFT',null,null,null,'Invalid cap')",
  [ids.admin, ids.affiliate],
));
const agreement = await asService(
  "select public.affiliate_portal_admin_save_agreement($1,null,$2,'BUILD_COST',10,'DRAFT',current_date,null,null,'Custom negotiated terms') as id",
  [ids.admin, ids.affiliate],
);
const agreementId = agreement[0].id;
await asService(
  "select public.affiliate_portal_admin_save_agreement_rate($1,$2,$3,12.5,'Website-specific rate')",
  [ids.admin, agreementId, ids.service],
);
await assert.rejects(() => asService(
  "select public.affiliate_portal_admin_save_agreement($1,$2,$3,'BUILD_COST',10,'ACTIVE',current_date,null,null,'Unsigned')",
  [ids.admin, agreementId, ids.affiliate],
));
await asService(
  "select public.affiliate_portal_admin_save_agreement($1,$2,$3,'BUILD_COST',10,'ACTIVE',current_date,null,now(),'Signed terms')",
  [ids.admin, agreementId, ids.affiliate],
);
assert.equal((await asAuthenticated(ids.verifiedApplicant, "select count(*)::int as count from public.affiliate_portal_agreements"))[0].count, 1);
assert.equal((await asAuthenticated(ids.unrelatedApplicant, "select count(*)::int as count from public.affiliate_portal_agreements"))[0].count, 0);
await assert.rejects(async () => {
  await db.exec("begin");
  try {
    await db.exec("set local role anon");
    await db.query("select * from public.affiliate_portal_agreements");
  } finally {
    await db.exec("rollback");
  }
});

const commission = await asService(
  "select * from public.affiliate_portal_admin_create_agreement_commission($1,$2,$3,$4,null,null,'APPROVED',100000)",
  [ids.admin, ids.affiliate, ids.service, ids.quote],
);
assert.equal(commission[0].amount_cents, 12500);
const snapshot = (await db.query("select base_amount_cents,rate_percent::text,commission_model,service_id from public.affiliate_portal_commission_snapshots where commission_id=$1", [commission[0].commission_id])).rows[0];
assert.deepEqual(snapshot, { base_amount_cents: 100000, rate_percent: "12.5000", commission_model: "BUILD_COST", service_id: ids.service });
assert.equal((await db.query("select commission_type from public.commissions where id=$1", [commission[0].commission_id])).rows[0].commission_type, "ONCE_OFF");

await db.exec(`
  create function public.fail_commission_audit() returns trigger language plpgsql as $$
  begin
    if new.action_type = 'create_commission' then raise exception 'forced audit failure'; end if;
    return new;
  end $$;
  create trigger fail_commission_audit before insert on public.affiliate_portal_audit_events
  for each row execute function public.fail_commission_audit();
`);
const before = (await db.query("select count(*)::int as count from public.commissions")).rows[0].count;
await assert.rejects(() => asService(
  "select * from public.affiliate_portal_admin_create_agreement_commission($1,$2,$3,null,$4,null,'PENDING',50000)",
  [ids.admin, ids.affiliate, ids.service, ids.project],
));
const after = (await db.query("select count(*)::int as count from public.commissions")).rows[0].count;
assert.equal(after, before);

console.log(JSON.stringify({
  serviceOnlyPermissions: "passed",
  crmAdminAuthorization: "passed",
  verifiedEmailApproval: "passed",
  explicitAffiliateSelection: "passed",
  declineCleanupSchedule: "passed",
  manualReferralAtomicity: "passed",
  customAgreementAndRateCap: "passed",
  productRateAndModelMapping: "passed",
  agreementOwnershipRls: "passed",
  commissionAtomicRollback: "passed",
}));

await db.close();
