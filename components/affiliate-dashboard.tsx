import {
  approvePortalApplication,
  cancelAffiliateSignatureRequest,
  createAffiliatePayoutBatch,
  createCommission,
  createReferral,
  deleteAffiliateAgreementRate,
  declinePortalApplication,
  saveAffiliateAgreement,
  saveAffiliateAgreementRate,
  sendAffiliateAgreementForSignature,
  setPortalTrackingLinkActive,
  updatePortalAffiliate,
  updateAffiliateAgreementStatus,
  updateAffiliatePayoutBatchStatus,
  updatePortalCommissionStatus,
} from "@/lib/actions";
import type { AffiliateOperationsData, PortalApplication } from "@/lib/affiliate-operations";
import { commissionStatuses, labelize } from "@/lib/constants";
import { money } from "@/lib/format";
import { AffiliateForm, SubmissionInput } from "./forms";
import { SubmitButton } from "./submit-button";
import { Card, EmptyState, Field, StatusBadge, inputClass } from "./ui";

function suggestedTrackingCode(application: PortalApplication) {
  const stem = `${application.first_name}-${application.surname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `${stem || "partner"}-${application.id.slice(0, 6)}`;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

function modelLabel(value: "BUILD_COST" | "LIFETIME") {
  return value === "BUILD_COST" ? "Build-cost commission" : "Lifetime commission";
}

const commissionTransitions: Record<string, string[]> = {
  PENDING: ["APPROVED", "CANCELLED", "DISPUTED"],
  APPROVED: ["PAYABLE", "CANCELLED", "DISPUTED"],
  PAYABLE: ["PAID", "CANCELLED", "DISPUTED"],
  DISPUTED: ["APPROVED", "CANCELLED"],
};

function ApplicationQueue({ data }: { data: AffiliateOperationsData }) {
  const mappedAffiliateIds = new Set(
    data.userLinks.flatMap((link) => link.affiliate_id ? [link.affiliate_id] : []),
  );
  const availableAffiliates = data.affiliates.filter(
    (affiliate) => !mappedAffiliateIds.has(affiliate.id),
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent-cyan">Application queue</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-deck-text">Partner approvals</h2>
          <p className="mt-1 text-sm text-deck-muted">Approval requires verified email ownership and an explicit create-or-link decision.</p>
        </div>
        <span className="rounded-full border border-accent-copper/30 bg-accent-copper/10 px-3 py-1 text-sm font-semibold text-accent-copper">
          {data.applications.filter((application) => application.status === "pending_review").length} pending
        </span>
      </div>

      {data.applications.length ? (
        <div className="mt-5 grid gap-4">
          {data.applications.map((application) => {
            const submissionKey = globalThis.crypto.randomUUID();
            return (
            <article key={application.id} className="rounded-xl border border-hairline bg-deck-bg/45 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-deck-text">{application.first_name} {application.surname}</h3>
                    <StatusBadge value={application.status} />
                    <span className={application.email_verified
                      ? "rounded-full border border-pos/30 bg-pos/10 px-2.5 py-1 text-xs font-semibold text-pos"
                      : "rounded-full border border-neg/30 bg-neg/10 px-2.5 py-1 text-xs font-semibold text-neg"}
                    >
                      {application.email_verified ? "Email verified" : "Email unverified"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-deck-muted">{application.business_name} · {application.email} · {application.phone}</p>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-deck-muted">{application.motivation}</p>
                  {application.preferred_commission_model ? <p className="mt-2 text-sm font-semibold text-accent-cyan">Preference: {modelLabel(application.preferred_commission_model)}</p> : null}
                  <p className="mt-2 font-mono text-xs text-deck-muted">Submitted {dateTime(application.submitted_at)}</p>
                </div>
              </div>

              {application.status === "pending_review" ? (
                <div className="mt-4">
                  {!application.email_verified ? <div className="mb-3 rounded-lg border border-accent-copper/30 bg-accent-copper/10 px-4 py-3 text-sm text-accent-copper"><strong>Approval locked:</strong> the applicant must click the verification link sent to {application.email}. Refresh this page after they verify; the approval buttons will then unlock.</div> : null}
                  <div className="grid gap-3 xl:grid-cols-3">
                  <form action={approvePortalApplication} className="rounded-lg border border-hairline bg-white/[0.025] p-4">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <input type="hidden" name="approvalMode" value="create" />
                    <input type="hidden" name="submissionKey" value={submissionKey} />
                    <Field label="Create CRM affiliate with tracking code">
                      <input className={inputClass} name="newTrackingCode" defaultValue={suggestedTrackingCode(application)} pattern="[a-z0-9][a-z0-9-]{3,39}" required />
                    </Field>
                    <SubmitButton className="mt-3 min-h-11 w-full" pendingLabel="Approving…" disabled={!application.email_verified}>
                      Create and approve
                    </SubmitButton>
                  </form>

                  <form action={approvePortalApplication} className="rounded-lg border border-hairline bg-white/[0.025] p-4">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <input type="hidden" name="approvalMode" value="link" />
                    <input type="hidden" name="submissionKey" value={submissionKey} />
                    <Field label="Link a selected existing affiliate">
                      <select className={inputClass} name="selectedAffiliateId" required>
                        <option value="">Choose an unmapped affiliate</option>
                        {availableAffiliates.map((affiliate) => (
                          <option key={affiliate.id} value={affiliate.id}>{affiliate.name} · {affiliate.tracking_code}</option>
                        ))}
                      </select>
                    </Field>
                    <SubmitButton className="mt-3 min-h-11 w-full" pendingLabel="Linking…" disabled={!application.email_verified || !availableAffiliates.length}>
                      Link and approve
                    </SubmitButton>
                  </form>

                  <form action={declinePortalApplication} className="rounded-lg border border-neg/20 bg-neg/[0.035] p-4">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <input type="hidden" name="submissionKey" value={submissionKey} />
                    <Field label="Decline reason">
                      <input className={inputClass} name="reason" minLength={3} maxLength={500} required />
                    </Field>
                    <SubmitButton className="mt-3 min-h-11 w-full bg-none bg-neg text-white" pendingLabel="Declining…">
                      Decline and schedule cleanup
                    </SubmitButton>
                  </form>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-deck-muted">
                  Reviewed {dateTime(application.reviewed_at)}
                  {application.rejection_reason ? ` · ${application.rejection_reason}` : ""}
                </p>
              )}
            </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5"><EmptyState title="No partner applications" body="New verified applications from the affiliate portal will appear here for an explicit admin decision." /></div>
      )}
    </Card>
  );
}

function AgreementManagement({ data }: { data: AffiliateOperationsData }) {
  const affiliateById = new Map(data.affiliates.map((affiliate) => [affiliate.id, affiliate]));
  const serviceById = new Map(data.services.map((service) => [service.id, service]));
  const signatureByAgreement = new Map(data.agreementSignatures.map((signature) => [signature.agreement_id, signature]));

  return (
    <Card>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent-cyan">Commercial terms</p>
      <h2 className="mt-2 font-display text-xl font-semibold text-deck-text">Electronic affiliate agreements</h2>
      <p className="mt-1 text-sm text-deck-muted">Build an unsigned draft, add negotiated rates, then send it to the verified affiliate for electronic signature. Signed terms are immutable.</p>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <form action={saveAffiliateAgreement} className="grid gap-3 rounded-xl border border-hairline bg-deck-bg/45 p-4">
          <SubmissionInput scope="affiliate-agreement-create" />
          <input type="hidden" name="status" value="DRAFT" />
          <h3 className="font-semibold text-deck-text">Create agreement draft</h3>
          <Field label="Affiliate"><select className={inputClass} name="affiliateId" required><option value="">Choose affiliate</option>{data.affiliates.map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}</select></Field>
          <Field label="Commission model"><select className={inputClass} name="commissionModel" required><option value="BUILD_COST">Build-cost commission</option><option value="LIFETIME">Lifetime commission</option></select></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default rate % (optional)"><input className={inputClass} name="defaultRatePercent" type="number" min="0.01" max="50" step="0.01" /></Field>
            <Field label="Effective from"><input className={inputClass} name="effectiveFrom" type="date" /></Field>
            <Field label="Effective to"><input className={inputClass} name="effectiveTo" type="date" /></Field>
          </div>
          <Field label="Negotiated terms"><textarea className={inputClass} name="termsSummary" minLength={3} maxLength={5000} required /></Field>
          <SubmitButton className="min-h-11" pendingLabel="Saving draft…">Save draft</SubmitButton>
        </form>
        <div className="grid gap-3">
          {data.agreements.length ? data.agreements.map((agreement) => {
            const signature = signatureByAgreement.get(agreement.id);
            const agreementRates = data.agreementRates.filter((rate) => rate.agreement_id === agreement.id);
            const operationalStatus = agreement.status === "SUSPENDED" || agreement.status === "ENDED" ? agreement.status : "ACTIVE";
            return (
            <article key={agreement.id} className="rounded-xl border border-hairline bg-deck-bg/45 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-deck-text">{affiliateById.get(agreement.affiliate_id)?.name ?? agreement.affiliate_id}</h3><p className="mt-1 text-sm text-accent-cyan">{modelLabel(agreement.commission_model)}</p></div><StatusBadge value={agreement.status} /></div>
              {agreement.status === "DRAFT" ? <>
              <form action={saveAffiliateAgreement} className="mt-4 grid gap-3">
                <SubmissionInput scope={`affiliate-agreement-update:${agreement.id}`} />
                <input type="hidden" name="agreementId" value={agreement.id} /><input type="hidden" name="affiliateId" value={agreement.affiliate_id} /><input type="hidden" name="status" value="DRAFT" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Model"><select className={inputClass} name="commissionModel" defaultValue={agreement.commission_model}><option value="BUILD_COST">Build-cost</option><option value="LIFETIME">Lifetime</option></select></Field>
                  <Field label="Default %"><input className={inputClass} name="defaultRatePercent" type="number" min="0.01" max="50" step="0.01" defaultValue={agreement.default_rate_percent ?? ""} /></Field>
                  <Field label="Effective from"><input className={inputClass} name="effectiveFrom" type="date" defaultValue={agreement.effective_from ?? ""} /></Field>
                  <Field label="Effective to"><input className={inputClass} name="effectiveTo" type="date" defaultValue={agreement.effective_to ?? ""} /></Field>
                </div>
                <Field label="Terms"><textarea className={inputClass} name="termsSummary" minLength={3} maxLength={5000} defaultValue={agreement.terms_summary ?? ""} required /></Field>
                <SubmitButton className="min-h-11" pendingLabel="Updating draft…">Update draft</SubmitButton>
              </form>
              <form action={saveAffiliateAgreementRate} className="mt-4 grid gap-3 border-t border-hairline pt-4">
                <SubmissionInput scope={`affiliate-agreement-rate:${agreement.id}`} />
                <input type="hidden" name="agreementId" value={agreement.id} />
                <h4 className="text-sm font-semibold text-deck-text">Add or update product rate</h4>
                <Field label="CRM product/service"><select className={inputClass} name="serviceId" required><option value="">Choose service</option>{data.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
                <div className="grid gap-3 sm:grid-cols-2"><Field label="Rate %"><input className={inputClass} name="ratePercent" type="number" min="0.01" max="50" step="0.01" required /></Field><Field label="Notes"><input className={inputClass} name="notes" maxLength={1000} /></Field></div>
                <SubmitButton className="min-h-11" pendingLabel="Saving rate…">Save product rate</SubmitButton>
              </form>
              {agreementRates.length ? <div className="mt-3 grid gap-2">{agreementRates.map((rate) => <div key={rate.id} className="flex items-center justify-between gap-3 rounded-lg border border-accent-cyan/20 bg-accent-cyan/[0.06] px-3 py-2"><span className="text-xs text-accent-cyan">{serviceById.get(rate.service_id)?.name ?? "Service"}: {rate.rate_percent}%</span><form action={deleteAffiliateAgreementRate}><input type="hidden" name="agreementRateId" value={rate.id} /><SubmitButton className="min-h-8 px-3 py-1 text-xs" pendingLabel="Removing…">Remove</SubmitButton></form></div>)}</div> : null}
              <form action={sendAffiliateAgreementForSignature} className="mt-4 border-t border-hairline pt-4"><SubmissionInput scope={`affiliate-agreement-send:${agreement.id}`} /><input type="hidden" name="agreementId" value={agreement.id} /><SubmitButton className="min-h-11 w-full" pendingLabel="Sending signature request…">Send for electronic signature</SubmitButton></form>
              </> : <div className="mt-4 grid gap-3 rounded-lg border border-hairline bg-white/[0.02] p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-deck-muted">{agreement.terms_summary}</p><p className="text-sm text-accent-cyan">{agreement.default_rate_percent ? `Default rate: ${agreement.default_rate_percent}%` : "Product-specific rates"}</p>{agreement.status === "PENDING_SIGNATURE" ? <><p className="text-xs text-accent-copper">Sent {dateTime(agreement.signature_requested_at)} · expires {dateTime(agreement.signature_request_expires_at)}</p><form action={cancelAffiliateSignatureRequest}><SubmissionInput scope={`affiliate-agreement-cancel:${agreement.id}`} /><input type="hidden" name="agreementId" value={agreement.id} /><SubmitButton className="min-h-10 w-full" pendingLabel="Cancelling…">Cancel request and return to draft</SubmitButton></form></> : null}{agreement.signed_at ? <div className="rounded-lg border border-pos/25 bg-pos/[0.06] p-3 text-xs text-pos"><p className="font-semibold">Signed {dateTime(agreement.signed_at)}</p>{signature ? <><p className="mt-1">{signature.signer_name} · {signature.signer_email}</p><p className="mt-1 break-all font-mono text-[10px]">SHA-256 {signature.agreement_sha256}</p></> : <p className="mt-1">Legacy manual signature timestamp preserved.</p>}</div> : null}{agreement.signed_at ? <form action={updateAffiliateAgreementStatus} className="flex flex-wrap items-center gap-2"><input type="hidden" name="agreementId" value={agreement.id} /><select className={inputClass} name="status" defaultValue={operationalStatus}>{["ACTIVE", "SUSPENDED", "ENDED"].map((status) => <option key={status}>{status}</option>)}</select><SubmitButton className="min-h-10 whitespace-nowrap" pendingLabel="Updating status…">Update status</SubmitButton></form> : null}</div>}
            </article>
          );}) : <EmptyState title="No agreements yet" body="Create a draft, record negotiated product rates, then send it to the affiliate for signature." />}
        </div>
      </div>
    </Card>
  );
}

function ManualOperations({ data }: { data: AffiliateOperationsData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <h2 className="font-display text-lg font-semibold text-deck-text">Create CRM affiliate</h2>
        <p className="mt-1 mb-4 text-sm text-deck-muted">For partners created outside the public application workflow.</p>
        <AffiliateForm compact />
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold text-deck-text">Manual lead attribution</h2>
        <p className="mt-1 mb-4 text-sm text-deck-muted">Creates the CRM referral and portal attribution together.</p>
        {data.affiliates.length && data.leads.length ? (
          <form action={createReferral} className="grid gap-3">
            <SubmissionInput scope="affiliate-referral-create" />
            <Field label="Affiliate">
              <select className={inputClass} name="affiliateId" required>
                {data.affiliates.map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}
              </select>
            </Field>
            <Field label="CRM lead">
              <select className={inputClass} name="leadId" required>
                {data.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name} · {lead.contact_name}</option>)}
              </select>
            </Field>
            <Field label="Attribution reason">
              <textarea className={inputClass} name="reason" minLength={3} maxLength={500} required />
            </Field>
            <SubmitButton className="min-h-11" pendingLabel="Attributing…">Record attribution</SubmitButton>
          </form>
        ) : <EmptyState title="Affiliate and lead required" body="Create an affiliate and a CRM lead before recording manual attribution." />}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold text-deck-text">Create commission</h2>
        <p className="mt-1 mb-4 text-sm text-deck-muted">The active agreement determines the model and rate; the result is stored as a locked snapshot.</p>
        {data.agreements.some((agreement) => agreement.status === "ACTIVE") ? (
          <form action={createCommission} className="grid gap-3">
            <SubmissionInput scope="affiliate-commission-create" />
            <Field label="Affiliate">
              <select className={inputClass} name="affiliateId" required>
                {data.affiliates.filter((affiliate) => data.agreements.some((agreement) => agreement.affiliate_id === affiliate.id && agreement.status === "ACTIVE")).map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}
              </select>
            </Field>
            <Field label="Quote source (optional)">
              <select className={inputClass} name="quoteId"><option value="">No quote</option>{data.quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quote_number} · {quote.title}</option>)}</select>
            </Field>
            <Field label="CRM product/service"><select className={inputClass} name="serviceId" required><option value="">Choose service</option>{data.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
            <Field label="Project source (optional)">
              <select className={inputClass} name="projectId"><option value="">No project</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
            </Field>
            <Field label="Payment source (optional)">
              <select className={inputClass} name="paymentId"><option value="">No payment</option>{data.payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.reference ?? payment.id} · {money(payment.amount_cents)}</option>)}</select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Commission base (R)"><input className={inputClass} name="baseAmountRands" type="number" min="0.01" step="0.01" required /></Field>
              <Field label="Status"><select className={inputClass} name="status">{commissionStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
            </div>
            <SubmitButton className="min-h-11" pendingLabel="Calculating…">Create commission</SubmitButton>
          </form>
        ) : <EmptyState title="No active agreement" body="Create, sign and activate an affiliate agreement before recording commissions." />}
      </Card>
    </div>
  );
}

function AffiliateControls({ data }: { data: AffiliateOperationsData }) {
  const affiliateById = new Map(data.affiliates.map((affiliate) => [affiliate.id, affiliate]));
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent-cyan">Partner controls</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-deck-text">Affiliate records</h2>
        <p className="mt-1 text-sm text-deck-muted">Update contact details, tracking codes and portal availability without changing historical commissions.</p>
        {data.affiliates.length ? <div className="mt-5 grid gap-3">{data.affiliates.map((affiliate) => (
          <form key={affiliate.id} action={updatePortalAffiliate} className="grid gap-3 rounded-xl border border-hairline bg-deck-bg/45 p-4 sm:grid-cols-2">
            <input type="hidden" name="affiliateId" value={affiliate.id} />
            <Field label="Name"><input className={inputClass} name="name" defaultValue={affiliate.name} required /></Field>
            <Field label="Email"><input className={inputClass} name="email" type="email" defaultValue={affiliate.email} required /></Field>
            <Field label="Tracking code"><input className={inputClass} name="trackingCode" defaultValue={affiliate.tracking_code} pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,63}" required /></Field>
            <Field label="Status"><select className={inputClass} name="status" defaultValue={affiliate.status}>{["ACTIVE", "PAUSED", "INACTIVE"].map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
            <div className="sm:col-span-2"><SubmitButton className="min-h-11" pendingLabel="Saving partner…">Save affiliate</SubmitButton></div>
          </form>
        ))}</div> : <div className="mt-5"><EmptyState title="No affiliate records" body="Approved partners will appear here." /></div>}
      </Card>

      <Card>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent-cyan">Campaign safety</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-deck-text">Tracking-link controls</h2>
        <p className="mt-1 text-sm text-deck-muted">Pause a link immediately without deleting its click history or attribution evidence.</p>
        {data.trackingLinks.length ? <div className="mt-5 grid gap-3">{data.trackingLinks.map((link) => (
          <article key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-deck-bg/45 p-4">
            <div><p className="font-semibold text-deck-text">{link.private_reference}</p><p className="mt-1 text-xs text-deck-muted">{affiliateById.get(link.affiliate_id)?.name ?? "Affiliate"} · {link.channel} · {link.destination_url}</p><p className="mt-1 font-mono text-xs text-accent-cyan">{link.tracking_token}</p></div>
            <form action={setPortalTrackingLinkActive}><input type="hidden" name="trackingLinkId" value={link.id} /><input type="hidden" name="isActive" value={link.is_active ? "false" : "true"} /><SubmitButton className="min-h-10" pendingLabel="Updating…">{link.is_active ? "Pause link" : "Reactivate link"}</SubmitButton></form>
          </article>
        ))}</div> : <div className="mt-5"><EmptyState title="No tracking links" body="Links generated by approved partners will appear here." /></div>}
      </Card>
    </div>
  );
}

function PayoutManagement({ data }: { data: AffiliateOperationsData }) {
  const affiliateById = new Map(data.affiliates.map((affiliate) => [affiliate.id, affiliate]));
  const batchedCommissionIds = new Set(data.payoutItems.map((item) => item.commission_id));
  const payable = data.commissions.filter((commission) =>
    commission.status === "PAYABLE" && !batchedCommissionIds.has(commission.id),
  );
  const itemsByBatch = new Map<string, typeof data.payoutItems>();
  for (const item of data.payoutItems) {
    itemsByBatch.set(item.payout_batch_id, [...(itemsByBatch.get(item.payout_batch_id) ?? []), item]);
  }
  const reference = `PAYOUT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${globalThis.crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const transitions: Record<string, string[]> = {
    DRAFT: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["PAID", "CANCELLED"],
  };

  return <Card>
    <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent-cyan">Payout control</p>
    <h2 className="mt-2 font-display text-xl font-semibold text-deck-text">Affiliate payout batches</h2>
    <p className="mt-1 text-sm text-deck-muted">Group payable commissions, record processing, and mark the full batch paid atomically.</p>
    <div className="mt-5 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <form action={createAffiliatePayoutBatch} className="grid h-fit gap-3 rounded-xl border border-hairline bg-deck-bg/45 p-4">
        <SubmissionInput scope="affiliate-payout-create" />
        <Field label="Payout reference"><input className={inputClass} name="reference" defaultValue={reference} required /></Field>
        <Field label="Scheduled date"><input className={inputClass} name="scheduledFor" type="date" /></Field>
        <Field label="Internal notes"><textarea className={inputClass} name="notes" maxLength={2000} /></Field>
        <fieldset><legend className="mb-2 text-sm text-deck-muted">Payable commissions</legend>{payable.length ? <div className="grid max-h-64 gap-2 overflow-y-auto">{payable.map((commission) => <label key={commission.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-hairline bg-white/[0.025] p-3 text-sm"><span><span className="block font-semibold text-deck-text">{affiliateById.get(commission.affiliate_id)?.name ?? "Affiliate"}</span><span className="text-xs text-deck-muted">{commission.id.slice(0, 8)}</span></span><span className="flex items-center gap-3 font-mono text-accent-cyan">{money(commission.amount_cents)}<input type="checkbox" name="commissionIds" value={commission.id} /></span></label>)}</div> : <p className="rounded-lg border border-hairline p-3 text-sm text-deck-muted">No unbatched payable commissions.</p>}</fieldset>
        <SubmitButton className="min-h-11" pendingLabel="Creating payout…" disabled={!payable.length}>Create payout batch</SubmitButton>
      </form>
      <div className="grid gap-3">
        {data.payoutBatches.length ? data.payoutBatches.map((batch) => {
          const items = itemsByBatch.get(batch.id) ?? [];
          const total = items.reduce((sum, item) => sum + item.amount_cents, 0);
          const next = transitions[batch.status] ?? [];
          return <article key={batch.id} className="rounded-xl border border-hairline bg-deck-bg/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-deck-text">{batch.reference}</p><p className="mt-1 text-xs text-deck-muted">{items.length} commission{items.length === 1 ? "" : "s"} · {batch.scheduled_for ?? "No scheduled date"}</p></div><div className="text-right"><StatusBadge value={batch.status} /><p className="mt-2 font-mono font-semibold text-deck-text">{money(total)}</p></div></div>{next.length ? <form action={updateAffiliatePayoutBatchStatus} className="mt-4 flex flex-wrap items-center gap-2"><SubmissionInput scope={`affiliate-payout-status:${batch.id}`} /><input type="hidden" name="payoutBatchId" value={batch.id} /><select className={inputClass} name="status">{next.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select><SubmitButton className="min-h-10 whitespace-nowrap" pendingLabel="Updating payout…">Update payout</SubmitButton></form> : null}{batch.paid_at ? <p className="mt-3 text-xs text-pos">Paid {dateTime(batch.paid_at)}</p> : null}</article>;
        }) : <EmptyState title="No payout batches" body="Move commissions to payable, then group them here for controlled payout." />}
      </div>
    </div>
  </Card>;
}

export function AffiliateDashboard({ data }: { data: AffiliateOperationsData }) {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const clicksLast30Days = data.clickStats.reduce((sum, stat) => sum + stat.clicks_30d, 0);
  const pendingCommissionCents = data.commissions
    .filter((commission) => !["PAID", "CANCELLED"].includes(commission.status))
    .reduce((sum, commission) => sum + commission.amount_cents, 0);
  const paidCommissionCents = data.commissions
    .filter((commission) => commission.status === "PAID")
    .reduce((sum, commission) => sum + commission.amount_cents, 0);
  const referralsByAffiliate = new Map<string, number>();
  const clicksByAffiliate = new Map<string, number>(
    data.clickStats.map((stat) => [stat.affiliate_id, stat.clicks_total]),
  );
  const commissionsByAffiliate = new Map<string, number>();
  for (const referral of data.referrals) referralsByAffiliate.set(referral.affiliate_id, (referralsByAffiliate.get(referral.affiliate_id) ?? 0) + 1);
  for (const commission of data.commissions) commissionsByAffiliate.set(commission.affiliate_id, (commissionsByAffiliate.get(commission.affiliate_id) ?? 0) + commission.amount_cents);
  const snapshotByCommission = new Map(data.snapshots.map((snapshot) => [snapshot.commission_id, snapshot]));
  const affiliateById = new Map(data.affiliates.map((affiliate) => [affiliate.id, affiliate]));
  const serviceById = new Map(data.services.map((service) => [service.id, service]));

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Pending applications", data.applications.filter((application) => application.status === "pending_review").length],
          ["Active affiliates", data.affiliates.filter((affiliate) => affiliate.status === "ACTIVE").length],
          ["Clicks · 30 days", clicksLast30Days],
          ["Attributed leads", data.attributions.length],
          ["Commission owed", money(pendingCommissionCents)],
          ["Commission paid", money(paidCommissionCents)],
        ].map(([label, value]) => (
          <Card key={label} className="min-h-28">
            <p className="text-sm text-deck-muted">{label}</p>
            <p className="mt-3 font-mono text-2xl font-bold text-deck-text">{value}</p>
          </Card>
        ))}
      </div>

      <ApplicationQueue data={data} />
      <AgreementManagement data={data} />
      <ManualOperations data={data} />
      <PayoutManagement data={data} />
      <AffiliateControls data={data} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-xl font-semibold text-deck-text">Affiliate performance</h2><p className="mt-1 text-sm text-deck-muted">CRM affiliates remain the source of truth; portal telemetry is layered alongside them.</p></div>
          <span className="font-mono text-xs text-deck-muted">{data.trackingLinks.filter((link) => link.is_active).length} active links</span>
        </div>
        {data.affiliates.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wider text-deck-muted"><tr><th className="px-3 py-3">Affiliate</th><th className="px-3 py-3">Tracking code</th><th className="px-3 py-3">Clicks</th><th className="px-3 py-3">Referrals</th><th className="px-3 py-3">Commission</th><th className="px-3 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-hairline">
                {data.affiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="transition-colors hover:bg-white/[0.025]"><td className="px-3 py-4"><p className="font-semibold text-deck-text">{affiliate.name}</p><p className="text-xs text-deck-muted">{affiliate.email}</p></td><td className="px-3 py-4 font-mono text-accent-cyan">{affiliate.tracking_code}</td><td className="px-3 py-4 font-mono">{clicksByAffiliate.get(affiliate.id) ?? 0}</td><td className="px-3 py-4 font-mono">{referralsByAffiliate.get(affiliate.id) ?? 0}</td><td className="px-3 py-4 font-mono">{money(commissionsByAffiliate.get(affiliate.id) ?? 0)}</td><td className="px-3 py-4"><StatusBadge value={affiliate.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="mt-5"><EmptyState title="No affiliates yet" body="Approve the first verified application or create a CRM affiliate manually." /></div>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <h2 className="font-display text-xl font-semibold text-deck-text">Commission ledger</h2>
          {data.commissions.length ? <div className="mt-4 grid gap-3">{data.commissions.slice(0, 20).map((commission) => {
            const affiliate = affiliateById.get(commission.affiliate_id);
            const snapshot = snapshotByCommission.get(commission.id);
            const transitions = commissionTransitions[commission.status] ?? [];
            return <div key={commission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-deck-bg/45 p-3"><div><p className="font-semibold text-deck-text">{affiliate?.name ?? commission.affiliate_id}</p><p className="text-xs text-deck-muted">{snapshot ? `${serviceById.get(snapshot.service_id ?? "")?.name ?? modelLabel(snapshot.commission_model ?? "BUILD_COST")} · ${money(snapshot.base_amount_cents)} × ${snapshot.rate_percent}%` : "Legacy commission without calculation snapshot"}</p></div><div className="flex flex-wrap items-center gap-3"><p className="font-mono font-semibold text-deck-text">{money(commission.amount_cents)}</p><StatusBadge value={commission.status} />{transitions.length ? <form action={updatePortalCommissionStatus} className="flex items-center gap-2"><input type="hidden" name="commissionId" value={commission.id} /><select className={inputClass} name="status" aria-label="Next commission status">{transitions.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select><SubmitButton className="min-h-10 whitespace-nowrap" pendingLabel="Updating…">Update</SubmitButton></form> : null}</div></div>;
          })}</div> : <div className="mt-4"><EmptyState title="No commissions" body="Calculated commission records will appear here with their immutable base-and-rate evidence." /></div>}
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold text-deck-text">Recent portal audit</h2>
          {data.auditEvents.length ? <div className="mt-4 grid gap-3">{data.auditEvents.slice(0, 12).map((event) => <div key={event.id} className="border-l-2 border-accent-cyan/40 pl-3"><p className="text-sm font-semibold text-deck-text">{labelize(event.action_type)}</p><p className="mt-0.5 font-mono text-xs text-deck-muted">{event.entity_type} · {dateTime(event.occurred_at)}</p></div>)}</div> : <div className="mt-4"><EmptyState title="No audit events" body="Approvals, attribution, and commission actions will be recorded here." /></div>}
        </Card>
      </div>
    </div>
  );
}
