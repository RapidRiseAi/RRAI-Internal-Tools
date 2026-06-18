"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { upsertQuote } from "@/lib/actions";
import { labelize, quoteStatuses } from "@/lib/constants";
import { money } from "@/lib/format";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import type { ClientOption, LeadOption, ServiceOption } from "./forms";

type QuoteLineItem = { serviceId: string; description: string; quantity: string; onceOffCents: string; monthlyCents: string };

const randToCents = (value: string) => Math.round(Number(value || 0) * 100);
const centsToRand = (value: number) => String(Math.round(value / 100));

function FormError({ message }: { message?: string }) {
  return message ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p> : null;
}

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="text-xs font-medium text-red-300">{messages[0]}</p> : null;
}
const blankLineItem = (): QuoteLineItem => ({ serviceId: "", description: "", quantity: "1", onceOffCents: "0", monthlyCents: "0" });

export function QuoteForm({ clients, leads, services }: { clients: ClientOption[]; leads: LeadOption[]; services: ServiceOption[] }) {
  const [state, formAction] = useActionState(upsertQuote, { ok: false });
  const submissionKey = useMemo(() => `upsert-quote:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, []);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<QuoteLineItem[]>([{ ...blankLineItem(), description: "Rapid Rise AI implementation package" }]);

  function updateItem(index: number, patch: Partial<QuoteLineItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function applyService(index: number, serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    updateItem(index, service ? { serviceId, description: service.description, onceOffCents: centsToRand(service.base_once_off_cents), monthlyCents: centsToRand(service.base_monthly_cents) } : { serviceId });
    if (service && !title) setTitle(service.name);
  }

  const onceOffTotal = items.reduce((sum, item) => sum + Number(item.quantity || 1) * randToCents(item.onceOffCents), 0);
  const monthlyTotal = items.reduce((sum, item) => sum + Number(item.quantity || 1) * randToCents(item.monthlyCents), 0);

  return <form action={formAction} className="grid gap-5"><FormError message={state.formError} />
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Title"><input className={inputClass} name="title" value={title} onChange={(event) => setTitle(event.target.value)} required /><FieldError messages={state.fieldErrors?.title} /></Field>
      <Field label="Status"><select className={inputClass} name="status" defaultValue="DRAFT">{quoteStatuses.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></Field>
      <Field label="Valid until"><input className={inputClass} type="date" name="validUntil" /></Field>
      <Field label="Client"><select className={inputClass} name="clientId"><option value="">No client yet</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
      <Field label="Lead"><select className={inputClass} name="leadId"><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></Field>
      <Field label="Internal notes"><textarea className={inputClass} name="internalNotes" /></Field>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold text-white">Line items</h3><p className="text-sm text-slate-400">Add every service, once-off fee and monthly fee that belongs on this quote.</p></div>
        <button type="button" onClick={() => setItems((current) => [...current, blankLineItem()])} className="inline-flex items-center gap-2 rounded-xl border border-rapid-cyan/30 bg-rapid-cyan/10 px-3 py-2 text-sm font-semibold text-rapid-cyan"><Plus className="size-4" /> Add line item</button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 lg:grid-cols-[1fr_1.4fr_0.45fr_0.7fr_0.7fr_auto]">
          <Field label="Service"><select className={inputClass} name="serviceId" value={item.serviceId} onChange={(event) => applyService(index, event.target.value)}><option value="">Custom item / other</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
          <Field label="Description"><input className={inputClass} name="itemDescription" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required /></Field>
          <Field label="Qty"><input className={inputClass} type="number" name="itemQuantity" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></Field>
          <Field label="Once-off (R)"><input className={inputClass} type="number" min="0" value={item.onceOffCents} onChange={(event) => updateItem(index, { serviceId: "", onceOffCents: event.target.value })} /><input type="hidden" name="itemOnceOffCents" value={randToCents(item.onceOffCents)} /></Field>
          <Field label="Monthly (R)"><input className={inputClass} type="number" min="0" value={item.monthlyCents} onChange={(event) => updateItem(index, { serviceId: "", monthlyCents: event.target.value })} /><input type="hidden" name="itemMonthlyCents" value={randToCents(item.monthlyCents)} /></Field>
          <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Remove line item"><Trash2 className="size-4" /></button>
        </div>)}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-3 text-sm"><span className="rounded-full bg-white/8 px-3 py-1 text-slate-200">Once-off total: {money(onceOffTotal)}</span><span className="rounded-full bg-white/8 px-3 py-1 text-slate-200">Monthly total: {money(monthlyTotal)}</span></div>
    </div>
    <div><SubmitButton>Create quote</SubmitButton></div>
  </form>;
}
