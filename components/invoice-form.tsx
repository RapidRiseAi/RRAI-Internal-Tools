"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { upsertInvoice } from "@/lib/actions";
import { invoiceStatuses, labelize } from "@/lib/constants";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import type { ClientOption } from "./forms";
import type { QuoteItem } from "@/lib/types";

export type InvoiceQuoteOption = { id: string; title: string; quote_number: string; client_id: string | null; once_off_total_cents: number; monthly_total_cents: number };
type InvoiceLineItem = { description: string; quantity: string; unitAmountCents: string };

const blankLineItem = (): InvoiceLineItem => ({ description: "", quantity: "1", unitAmountCents: "0" });

export function InvoiceForm({ clients, quotes, quoteItems }: { clients: ClientOption[]; quotes: InvoiceQuoteOption[]; quoteItems: QuoteItem[] }) {
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
    const quoteRows = quoteItems.filter((item) => item.quote_id === quote.id).flatMap((item) => [
      item.once_off_cents > 0 ? { description: `${item.description} — once-off`, quantity: String(item.quantity), unitAmountCents: String(item.once_off_cents) } : null,
      item.monthly_cents > 0 ? { description: `${item.description} — monthly`, quantity: String(item.quantity), unitAmountCents: String(item.monthly_cents) } : null,
    ]).filter(Boolean) as InvoiceLineItem[];
    setItems(quoteRows.length ? quoteRows : [{ description: quote.title, quantity: "1", unitAmountCents: String(quote.once_off_total_cents + quote.monthly_total_cents) }]);
  }

  const totalCents = items.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.unitAmountCents || 0), 0);

  return <form action={upsertInvoice} className="grid gap-5">
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <input type="hidden" name="quoteId" value={quoteId} />
    <input type="hidden" name="amountCents" value={totalCents} />
    <div className="grid gap-4 md:grid-cols-4">
      <Field label="Based on quote"><select className={inputClass} value={quoteId} onChange={(event) => applyQuote(event.target.value)}><option value="">No quote / custom invoice</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quote_number} — {quote.title}</option>)}</select></Field>
      <Field label="Client"><select className={inputClass} name="clientId" value={clientId} onChange={(event) => { setQuoteId(""); setClientId(event.target.value); }} required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
      <Field label="Invoice #"><input className={inputClass} name="invoiceNumber" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Auto if empty" /></Field>
      <Field label="Status"><select className={inputClass} name="status" defaultValue="SENT">{invoiceStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
      <Field label="Due date"><input className={inputClass} name="dueDate" type="date" /></Field>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold text-white">Invoice line items</h3><p className="text-sm text-slate-400">Create a custom invoice from scratch or edit the line items loaded from a quote.</p></div>
        <button type="button" onClick={() => setItems((current) => [...current, blankLineItem()])} className="inline-flex items-center gap-2 rounded-xl border border-rapid-cyan/30 bg-rapid-cyan/10 px-3 py-2 text-sm font-semibold text-rapid-cyan"><Plus className="size-4" /> Add line item</button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 md:grid-cols-[1.5fr_0.35fr_0.65fr_auto]">
          <Field label="Description"><input className={inputClass} name="invoiceItemDescription" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required /></Field>
          <Field label="Qty"><input className={inputClass} name="invoiceItemQuantity" type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} required /></Field>
          <Field label="Unit amount cents"><input className={inputClass} name="invoiceItemUnitCents" type="number" min="0" value={item.unitAmountCents} onChange={(event) => updateItem(index, { unitAmountCents: event.target.value })} required /></Field>
          <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Remove line item"><Trash2 className="size-4" /></button>
        </div>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Total is calculated from the editable line items.</p><span className="rounded-full bg-white/8 px-3 py-1 text-sm text-slate-200">Total: {totalCents} cents</span></div>
    </div>
    <div><SubmitButton pendingLabel="Creating invoice…">Create invoice</SubmitButton></div>
    {selectedQuote ? <p className="rounded-xl border border-rapid-cyan/20 bg-rapid-cyan/10 px-3 py-2 text-sm text-rapid-cyan">Loaded from {selectedQuote.quote_number}. You can still add, remove and edit invoice line items before creating.</p> : null}
  </form>;
}
