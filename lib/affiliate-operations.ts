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
  preferred_commission_model: "BUILD_COST" | "LIFETIME" | "RECURRING" | null;
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

export type AffiliateClickStat = {
  affiliate_id: string;
  clicks_total: number;
  clicks_30d: number;
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
  commission_model: "BUILD_COST" | "LIFETIME" | "RECURRING" | null;
};

export type PortalAgreement = {
  id: string;
  affiliate_id: string;
  commission_model: "BUILD_COST" | "LIFETIME" | "RECURRING";
  default_rate_percent: number | null;
  status: "DRAFT" | "PENDING_SIGNATURE" | "ACTIVE" | "SUSPENDED" | "ENDED";
  effective_from: string | null;
  effective_to: string | null;
  signed_at: string | null;
  terms_summary: string | null;
  signature_requested_at: string | null;
  signature_request_expires_at: string | null;
  created_at: string;
};

export type PortalAgreementSignature = {
  id: string;
  agreement_id: string;
  signer_name: string;
  signer_email: string;
  agreement_sha256: string;
  consent_version: string;
  signed_at: string;
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

export type PortalPayoutBatch = {
  id: string;
  reference: string;
  status: "DRAFT" | "PROCESSING" | "PAID" | "CANCELLED";
  scheduled_for: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export type PortalPayoutItem = {
  id: string;
  payout_batch_id: string;
  commission_id: string;
  affiliate_id: string;
  amount_cents: number;
};

export type PayoutMethod = {
  affiliate_id: string;
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  tax_number: string | null;
  paypal_email: string | null;
};

export type AffiliateOperationsData = {
  affiliates: Affiliate[];
  applications: PortalApplication[];
  userLinks: PortalUserLink[];
  trackingLinks: PortalTrackingLink[];
  clickStats: AffiliateClickStat[];
  referrals: Referral[];
  commissions: Commission[];
  snapshots: CommissionSnapshot[];
  agreements: PortalAgreement[];
  agreementRates: PortalAgreementRate[];
  agreementSignatures: PortalAgreementSignature[];
  payoutBatches: PortalPayoutBatch[];
  payoutItems: PortalPayoutItem[];
  payoutMethods: PayoutMethod[];
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
      affiliates: [], applications: [], userLinks: [], trackingLinks: [], clickStats: [],
      referrals: [], commissions: [], snapshots: [], attributions: [], auditEvents: [],
      agreements: [], agreementRates: [], agreementSignatures: [], payoutBatches: [], payoutItems: [], payoutMethods: [], services: [], leads: [], quotes: [], projects: [], payments: [],
    };
  }

  const supabase = getSupabaseAdmin();
  const [
    affiliatesResult,
    applicationsResult,
    userLinksResult,
    trackingLinksResult,
    clickStatsResult,
    referralsResult,
    commissionsResult,
    snapshotsResult,
    agreementsResult,
    agreementRatesResult,
    agreementSignaturesResult,
    payoutBatchesResult,
    payoutItemsResult,
    payoutMethodsResult,
    servicesResult,
    attributionsResult,
    auditResult,
    leadsResult,
    quotesResult,
    projectsResult,
    paymentsResult,
  ] = await Promise.all([
    supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_partner_applications").select("*").order("submitted_at", { ascending: false }).limit(100),
    supabase.from("affiliate_portal_user_links").select("auth_user_id,affiliate_id,crm_user_id"),
    supabase.from("affiliate_portal_tracking_links").select("id,affiliate_id,tracking_token,destination_url,private_reference,channel,is_active,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_affiliate_click_stats").select("affiliate_id,clicks_total,clicks_30d"),
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    supabase.from("commissions").select("*").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_commission_snapshots").select("commission_id,base_amount_cents,rate_percent,agreement_id,agreement_rate_id,service_id,commission_model"),
    supabase.from("affiliate_portal_agreements").select("id,affiliate_id,commission_model,default_rate_percent,status,effective_from,effective_to,signed_at,terms_summary,signature_requested_at,signature_request_expires_at,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_agreement_rates").select("id,agreement_id,service_id,rate_percent,notes"),
    supabase.from("affiliate_portal_agreement_signatures").select("id,agreement_id,signer_name,signer_email,agreement_sha256,consent_version,signed_at"),
    supabase.from("affiliate_portal_payout_batches").select("id,reference,status,scheduled_for,paid_at,notes,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_payout_items").select("id,payout_batch_id,commission_id,affiliate_id,amount_cents"),
    supabase.from("affiliate_portal_payout_methods").select("affiliate_id,account_holder,bank_name,account_number,branch_code,tax_number,paypal_email"),
    supabase.from("services").select("id,name,category,description,base_once_off_cents,base_monthly_cents,is_active").eq("is_active", true).order("name"),
    supabase.from("affiliate_portal_lead_attributions").select("id,crm_referral_id,attribution_source,fraud_flag,manual_attribution_reason,created_at").order("created_at", { ascending: false }),
    supabase.from("affiliate_portal_audit_events").select("id,actor_crm_user_id,affiliate_id,action_type,entity_type,entity_id,occurred_at").order("occurred_at", { ascending: false }).limit(50),
    supabase.from("leads").select("*").is("archived_at", null).order("updated_at", { ascending: false }),
    supabase.from("quotes").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
  ]);

  const loadedApplications = dataOrThrow<PortalApplication[]>(applicationsResult, "Load partner applications");
  // Check verification only for the loaded applicants (not all auth users), so this
  // stays correct and cheap regardless of how many auth users exist.
  const applicantAuthIds = loadedApplications.map((application) => application.auth_user_id);
  const verifiedAuthUserIds = new Set<string>();
  if (applicantAuthIds.length) {
    const { data: verifiedRows, error: verifiedError } = await supabase.rpc(
      "affiliate_portal_admin_verified_auth_users",
      { p_auth_user_ids: applicantAuthIds },
    );
    if (verifiedError) throw new Error(`Load applicant verification: ${verifiedError.message}`);
    for (const row of (verifiedRows ?? []) as Array<{ auth_user_id: string }>) {
      verifiedAuthUserIds.add(row.auth_user_id);
    }
  }
  const applications = loadedApplications.map((application) => ({
    ...application,
    email_verified: verifiedAuthUserIds.has(application.auth_user_id),
  }));

  return {
    affiliates: dataOrThrow<Affiliate[]>(affiliatesResult, "Load affiliates"),
    applications,
    userLinks: dataOrThrow<PortalUserLink[]>(userLinksResult, "Load portal user mappings"),
    trackingLinks: dataOrThrow<PortalTrackingLink[]>(trackingLinksResult, "Load tracking links"),
    clickStats: dataOrThrow<AffiliateClickStat[]>(clickStatsResult, "Load click stats"),
    referrals: dataOrThrow<Referral[]>(referralsResult, "Load referrals"),
    commissions: dataOrThrow<Commission[]>(commissionsResult, "Load commissions"),
    snapshots: dataOrThrow<CommissionSnapshot[]>(snapshotsResult, "Load commission snapshots"),
    agreements: dataOrThrow<PortalAgreement[]>(agreementsResult, "Load affiliate agreements"),
    agreementRates: dataOrThrow<PortalAgreementRate[]>(agreementRatesResult, "Load agreement product rates"),
    agreementSignatures: dataOrThrow<PortalAgreementSignature[]>(agreementSignaturesResult, "Load agreement signatures"),
    payoutBatches: dataOrThrow<PortalPayoutBatch[]>(payoutBatchesResult, "Load payout batches"),
    payoutItems: dataOrThrow<PortalPayoutItem[]>(payoutItemsResult, "Load payout items"),
    payoutMethods: dataOrThrow<PayoutMethod[]>(payoutMethodsResult, "Load payout methods"),
    services: dataOrThrow<Service[]>(servicesResult, "Load CRM services"),
    attributions: dataOrThrow<PortalAttribution[]>(attributionsResult, "Load lead attributions"),
    auditEvents: dataOrThrow<PortalAuditEvent[]>(auditResult, "Load portal audit events"),
    leads: dataOrThrow<Lead[]>(leadsResult, "Load CRM leads"),
    quotes: dataOrThrow<Quote[]>(quotesResult, "Load quotes"),
    projects: dataOrThrow<Project[]>(projectsResult, "Load projects"),
    payments: dataOrThrow<Payment[]>(paymentsResult, "Load payments"),
  };
}
