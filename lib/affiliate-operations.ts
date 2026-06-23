import "server-only";

import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";
import type {
  Affiliate,
  Commission,
  Lead,
  Payment,
  Project,
  Quote,
  Referral,
  Service,
} from "./types";

export type PortalApplication = {
  id: string;
  auth_user_id: string;
  first_name: string;
  surname: string;
  business_name: string;
  email: string;
  phone: string;
  client_types: string;
  motivation: string;
  status: "pending_review" | "approved" | "declined" | "deleted_or_anonymised";
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  deletion_scheduled_at: string | null;
  preferred_commission_model: "BUILD_COST" | "LIFETIME" | null;
  email_verified: boolean;
};

export type PortalUserLink = {
  auth_user_id: string;
  affiliate_id: string | null;
  crm_user_id: string | null;
};

export type PortalTrackingLink = {
  id: string;
  affiliate_id: string;
  tracking_token: string;
  destination_url: string;
  private_reference: string;
  channel: string;
  is_active: boolean;
  created_at: string;
};

export type PortalClick = {
  id: string;
  affiliate_id: string | null;
  occurred_at: string;
};

export type PortalAttribution = {
  id: string;
  crm_referral_id: string;
  attribution_source: string;
  fraud_flag: boolean;
  manual_attribution_reason: string | null;
  created_at: string;
};

export type CommissionSnapshot = {
  commission_id: string;
  base_amount_cents: number;
  rate_percent: number;
  agreement_id: string | null;
  agreement_rate_id: string | null;
  service_id: string | null;
  commission_model: "BUILD_COST" | "LIFETIME" | null;
};

export type PortalAgreement = {
  id: string;
  affiliate_id: string;
  commission_model: "BUILD_COST" | "LIFETIME";
  default_rate_percent: number | null;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ENDED";
  effective_from: string | null;
  effective_to: string | null;
  signed_at: string | null;
  terms_summary: string | null;
  created_at: string;
};

export type PortalAgreementRate = {
  id: string;
  agreement_id: string;
  service_id: string;
  rate_percent: number;
  notes: string | null;
};

export type PortalAuditEvent = {
  id: string;
  actor_crm_user_id: string | null;
  affiliate_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
};

export type AffiliateOperationsData = {
  affiliates: Affiliate[];
  applications: PortalApplication[];
  userLinks: PortalUserLink[];
  trackingLinks: PortalTrackingLink[];
  clicks: PortalClick[];
  referrals: Referral[];
  commissions: Commission[];
  snapshots: CommissionSnapshot[];
  agreements: PortalAgreement[];
  agreementRates: PortalAgreementRate[];
  services: Service[];
  attributions: PortalAttribution[];
  auditEvents: PortalAuditEvent[];
  leads: Lead[];
  quotes: Quote[];
  projects: Project[];
  payments: Payment[];
};

function dataOrThrow<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

export async function loadAffiliateOperations(): Promise<AffiliateOperationsData> {
  if (!hasSupabaseConfig()) {
    return {
      affiliates: [], applications: [], userLinks: [], trackingLinks: [], clicks: [],
      referrals: [], commissions: [], snapshots: [], attributions: [], auditEvents: [],
      agreements: [], agreementRates: [], services: [], leads: [], quotes: [], projects: [], payments: [],
    };
  }

  const supabase = getSupabaseAdmin();
  const [
    affiliatesResult,
    applicationsResult,
    userLinksResult,
    trackingLinksResult,
    clicksResult,
    referralsResult,
    commissionsResult,
    snapshotsResult,
    agreementsResult,
    agreementRatesResult,
    servicesResult,
    attributionsResult,
    auditResult,
    leadsResult,
    quotesResult,
    projectsResult,
    paymentsResult,
    authUsersResult,
  ] = await Promise.all([
    supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_partner_applications").select("*").order("submitted_at", { ascending: false }).limit(100),
    supabase.from("affiliate_portal_user_links").select("auth_user_id,affiliate_id,crm_user_id"),
    supabase.from("affiliate_portal_tracking_links").select("id,affiliate_id,tracking_token,destination_url,private_reference,channel,is_active,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_click_events").select("id,affiliate_id,occurred_at").order("occurred_at", { ascending: false }).limit(5000),
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    supabase.from("commissions").select("*").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_commission_snapshots").select("commission_id,base_amount_cents,rate_percent,agreement_id,agreement_rate_id,service_id,commission_model"),
    supabase.from("affiliate_portal_agreements").select("id,affiliate_id,commission_model,default_rate_percent,status,effective_from,effective_to,signed_at,terms_summary,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_agreement_rates").select("id,agreement_id,service_id,rate_percent,notes"),
    supabase.from("services").select("id,name,category,description,base_once_off_cents,base_monthly_cents,is_active").eq("is_active", true).order("name"),
    supabase.from("affiliate_portal_lead_attributions").select("id,crm_referral_id,attribution_source,fraud_flag,manual_attribution_reason,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_audit_events").select("id,actor_crm_user_id,affiliate_id,action_type,entity_type,entity_id,occurred_at").order("occurred_at", { ascending: false }).limit(50),
    supabase.from("leads").select("*").is("archived_at", null).order("updated_at", { ascending: false }),
    supabase.from("quotes").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (authUsersResult.error) {
    throw new Error(`Load applicant Auth users: ${authUsersResult.error.message}`);
  }
  const authUsers = authUsersResult.data?.users ?? [];
  const verifiedAuthUserIds = new Set(
    authUsers.filter((user) => Boolean(user.email_confirmed_at)).map((user) => user.id),
  );
  const applications = dataOrThrow<PortalApplication[]>(applicationsResult, "Load partner applications")
    .map((application) => ({
      ...application,
      email_verified: verifiedAuthUserIds.has(application.auth_user_id),
    }));

  return {
    affiliates: dataOrThrow<Affiliate[]>(affiliatesResult, "Load affiliates"),
    applications,
    userLinks: dataOrThrow<PortalUserLink[]>(userLinksResult, "Load portal user mappings"),
    trackingLinks: dataOrThrow<PortalTrackingLink[]>(trackingLinksResult, "Load tracking links"),
    clicks: dataOrThrow<PortalClick[]>(clicksResult, "Load click events"),
    referrals: dataOrThrow<Referral[]>(referralsResult, "Load referrals"),
    commissions: dataOrThrow<Commission[]>(commissionsResult, "Load commissions"),
    snapshots: dataOrThrow<CommissionSnapshot[]>(snapshotsResult, "Load commission snapshots"),
    agreements: dataOrThrow<PortalAgreement[]>(agreementsResult, "Load affiliate agreements"),
    agreementRates: dataOrThrow<PortalAgreementRate[]>(agreementRatesResult, "Load agreement product rates"),
    services: dataOrThrow<Service[]>(servicesResult, "Load CRM services"),
    attributions: dataOrThrow<PortalAttribution[]>(attributionsResult, "Load lead attributions"),
    auditEvents: dataOrThrow<PortalAuditEvent[]>(auditResult, "Load portal audit events"),
    leads: dataOrThrow<Lead[]>(leadsResult, "Load CRM leads"),
    quotes: dataOrThrow<Quote[]>(quotesResult, "Load quotes"),
    projects: dataOrThrow<Project[]>(projectsResult, "Load projects"),
    payments: dataOrThrow<Payment[]>(paymentsResult, "Load payments"),
  };
}
