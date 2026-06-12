"use client";

import { useMemo, useState } from "react";
import { upsertQuote } from "@/lib/actions";
import { labelize, quoteStatuses } from "@/lib/constants";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import type { ClientOption, LeadOption, ServiceOption } from "./forms";

export function QuoteForm({ clients, leads, services }: { clients: ClientOption[]; leads: LeadOption[]; services: ServiceOption[] }) {
  const submissionKey = useMemo(() => `upsert-quote:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, []);
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("Rapid Rise AI implementation package");
  const [onceOffCents, setOnceOffCents] = useState("0");
  const [monthlyCents, setMonthlyCents] = useState("0");

  function applyService(nextServiceId: string) {
    setServiceId(nextServiceId);
    const service = services.find((item) => item.id === nextServiceId);
    if (!service) return;
    setTitle(service.name);
    setDescription(service.description);
    setOnceOffCents(String(service.base_once_off_cents));
    setMonthlyCents(String(service.base_monthly_cents));
  }

  return <form action={upsertQuote} className="grid gap-4 md:grid-cols-3">
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <Field label="Title"><input className={inputClass} name="title" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
    <Field label="Status"><select className={inputClass} name="status" defaultValue="DRAFT">{quoteStatuses.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></Field>
    <Field label="Valid until"><input className={inputClass} type="date" name="validUntil" /></Field>
    <Field label="Client"><select className={inputClass} name="clientId"><option value="">No client yet</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
    <Field label="Lead"><select className={inputClass} name="leadId"><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></Field>
    <Field label="Service"><select className={inputClass} name="serviceId" value={serviceId} onChange={(event) => applyService(event.target.value)}><option value="">Custom item / other</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
    <Field label="Line item description"><input className={inputClass} name="itemDescription" value={description} onChange={(event) => setDescription(event.target.value)} required /></Field>
    <Field label="Quantity"><input className={inputClass} type="number" name="itemQuantity" min="1" defaultValue="1" /></Field>
    <Field label="Once-off cents"><input className={inputClass} type="number" name="itemOnceOffCents" min="0" value={onceOffCents} placeholder="0" onChange={(event) => { setServiceId(""); setOnceOffCents(event.target.value); }} /></Field>
    <Field label="Monthly cents"><input className={inputClass} type="number" name="itemMonthlyCents" min="0" value={monthlyCents} placeholder="0" onChange={(event) => { setServiceId(""); setMonthlyCents(event.target.value); }} /></Field>
    <Field label="Internal notes"><textarea className={inputClass} name="internalNotes" /></Field>
    <div className="flex items-end"><SubmitButton>Create quote</SubmitButton></div>
  </form>;
}
