"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { upsertInvoice } from "@/lib/actions";
import { invoiceStatuses, labelize } from "@/lib/constants";
import { money } from "@/lib/format";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import type { ClientOption } from "./forms";
import type { QuoteItem } from "@/lib/types";

export type InvoiceQuoteOption = { id: string; title: string; quote_number: string; client_id: string | null; once_off_total_cents: number; monthly_total_cents: number };
export type InvoiceServiceOption = { id: string; name: string };
type InvoiceLineItem = { description: string; quantity: string; buildCostRands: string; recurringRands: string; serviceId: string };

const randToCents = (value: string) => Math.round(Number(value || 0) * 100);
const centsToRand = (value: number) => String(Math.round(value / 100));

function FormError({ message }: { message?: string }) {
  return message ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p> : null;
}

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="text-xs font-medium text-red-300">{messages[0]}</p> : null;
}
const blankLineItem = (): InvoiceLineItem => ({ description: "", quantity: "1", buildCostRands: "0", recurringRands: "0", serviceId: "" });

export function InvoiceForm({ clients, quotes, quoteItems, services = [] }: { clients: ClientOption[]; quotes: InvoiceQuoteOption[]; quoteItems: QuoteItem[]; services?: InvoiceServiceOption[] }) {
  const [state, formAction] = useActionState(upsertInvoice, { ok: false });
  const submissionKey = useMemo(() => `upsert-invoice:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, []);
  const [quoteId, setQuoteId] = useState("");
  const selectedQuote = useMemo(() => quotes.find((quote) => quote.id === quoteId), [quoteId, quotes]);
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([{ ...blankLineItem(), description: "Professional services" }]);

  function updateItem(index: number, patch: Partial<InvoiceLineItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function applyQuote(nextQuoteId: string) {
    setQuoteId(nextQuoteId);
    const quote = quotes.find((item) => item.id === nextQuoteId);
    if (!quote) return;
    setClientId(quote.client_id ?? "");
    setInvoiceNumber(`INV-${quote.quote_number.replace(/^Q-?/, "")}`);
    // One invoice line per quote item: once-off -> build cost, monthly -> recurring.
    const quoteRows = quoteItems.filter((item) => item.quote_id === quote.id).map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      buildCostRands: centsToRand(item.once_off_cents),
      recurringRands: centsToRand(item.monthly_cents),
      serviceId: item.service_id ?? "",
    }));
    setItems(quoteRows.length ? quoteRows : [{ description: quote.title, quantity: "1", buildCostRands: centsToRand(quote.once_off_total_cents), recurringRands: centsToRand(quote.monthly_total_cents), serviceId: "" }]);
  }

  const buildTotalCents = items.reduce((sum, item) => sum + Number(item.quantity || 1) * randToCents(item.buildCostRands), 0);
  const recurringTotalCents = items.reduce((sum, item) => sum + Number(item.quantity || 1) * randToCents(item.recurringRands), 0);

  return <form action={formAction} className="grid gap-5"><FormError message={state.formError} />
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <input type="hidden" name="quoteId" value={quoteId} />
    <input type="hidden" name="amountCents" value={buildTotalCents} />
    <div className="grid gap-4 md:grid-cols-4">
      <Field label="Based on quote"><select className={inputClass} value={quoteId} onChange={(event) => applyQuote(event.target.value)}><option value="">No quote / custom invoice</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quote_number} — {quote.title}</option>)}</select></Field>
      <Field label="Client"><select className={inputClass} name="clientId" value={clientId} onChange={(event) => { setQuoteId(""); setClientId(event.target.value); }} required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select><FieldError messages={state.fieldErrors?.clientId} /></Field>
      <Field label="Invoice #"><input className={inputClass} name="invoiceNumber" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Auto if empty" /></Field>
      <Field label="Status"><select className={inputClass} name="status" defaultValue="SENT">{invoiceStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
      <Field label="Due date"><input className={inputClass} name="dueDate" type="date" /></Field>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold text-white">Invoice line items</h3><p className="text-sm text-slate-400">Every line has a build cost (billed on this invoice) and a recurring amount (seeds a monthly retainer). Set either to 0 if not applicable. The service drives the commission rate.</p></div>
        <button type="button" onClick={() => setItems((current) => [...current, blankLineItem()])} className="inline-flex items-center gap-2 rounded-xl border border-rapid-cyan/30 bg-rapid-cyan/10 px-3 py-2 text-sm font-semibold text-rapid-cyan"><Plus className="size-4" /> Add line item</button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 md:grid-cols-[1.1fr_0.85fr_0.3fr_0.5fr_0.5fr_auto]">
          <Field label="Description"><input className={inputClass} name="invoiceItemDescription" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required /></Field>
          <Field label="Service (commission rate)"><select className={inputClass} name="invoiceServiceId" value={item.serviceId} onChange={(event) => updateItem(index, { serviceId: event.target.value })}><option value="">None / default rate</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
          <Field label="Qty"><input className={inputClass} name="invoiceItemQuantity" type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} required /></Field>
          <Field label="Build cost (R)"><input className={inputClass} type="number" min="0" step="0.01" value={item.buildCostRands} onChange={(event) => updateItem(index, { buildCostRands: event.target.value })} required /><input type="hidden" name="invoiceItemUnitCents" value={randToCents(item.buildCostRands)} /></Field>
          <Field label="Recurring/mo (R)"><input className={inputClass} type="number" min="0" step="0.01" value={item.recurringRands} onChange={(event) => updateItem(index, { recurringRands: event.target.value })} required /><input type="hidden" name="invoiceItemRecurringCents" value={randToCents(item.recurringRands)} /></Field>
          <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Remove line item"><Trash2 className="size-4" /></button>
        </div>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">This invoice bills the build cost. Any recurring amount creates a monthly retainer automatically.</p><div className="flex gap-2"><span className="rounded-full bg-white/8 px-3 py-1 text-sm text-slate-200">Build: {money(buildTotalCents)}</span><span className="rounded-full bg-white/8 px-3 py-1 text-sm text-slate-200">Recurring/mo: {money(recurringTotalCents)}</span></div></div>
    </div>
    <div><SubmitButton pendingLabel="Creating invoice…">Create invoice</SubmitButton></div>
    {selectedQuote ? <p className="rounded-xl border border-rapid-cyan/20 bg-rapid-cyan/10 px-3 py-2 text-sm text-rapid-cyan">Loaded from {selectedQuote.quote_number}. You can still add, remove and edit invoice line items before creating.</p> : null}
  </form>;
}
