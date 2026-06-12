"use client";

import { useMemo, useState } from "react";
import { upsertInvoice } from "@/lib/actions";
import { invoiceStatuses, labelize } from "@/lib/constants";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import type { ClientOption } from "./forms";

export type InvoiceQuoteOption = { id: string; title: string; quote_number: string; client_id: string | null; once_off_total_cents: number; monthly_total_cents: number };

export function InvoiceForm({ clients, quotes }: { clients: ClientOption[]; quotes: InvoiceQuoteOption[] }) {
  const submissionKey = useMemo(() => `upsert-invoice:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, []);
  const [quoteId, setQuoteId] = useState("");
  const selectedQuote = useMemo(() => quotes.find((quote) => quote.id === quoteId), [quoteId, quotes]);
  const [clientId, setClientId] = useState("");
  const [amountCents, setAmountCents] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  function applyQuote(nextQuoteId: string) {
    setQuoteId(nextQuoteId);
    const quote = quotes.find((item) => item.id === nextQuoteId);
    if (!quote) return;
    setClientId(quote.client_id ?? "");
    setAmountCents(String(quote.once_off_total_cents + quote.monthly_total_cents));
    setInvoiceNumber(`INV-${quote.quote_number.replace(/^Q-?/, "")}`);
  }

  return <form action={upsertInvoice} className="grid gap-4 md:grid-cols-4">
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <input type="hidden" name="quoteId" value={quoteId} />
    <Field label="Based on quote"><select className={inputClass} value={quoteId} onChange={(event) => applyQuote(event.target.value)}><option value="">No quote / custom invoice</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quote_number} — {quote.title}</option>)}</select></Field>
    <Field label="Client"><select className={inputClass} name="clientId" value={clientId} onChange={(event) => { setQuoteId(""); setClientId(event.target.value); }} required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
    <Field label="Invoice #"><input className={inputClass} name="invoiceNumber" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Auto if empty" /></Field>
    <Field label="Status"><select className={inputClass} name="status" defaultValue="SENT">{invoiceStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
    <Field label="Amount cents"><input className={inputClass} name="amountCents" type="number" min="1" value={amountCents} onChange={(event) => setAmountCents(event.target.value)} required /></Field>
    <Field label="Due date"><input className={inputClass} name="dueDate" type="date" /></Field>
    <div className="flex items-end"><SubmitButton pendingLabel="Creating invoice…">Create invoice</SubmitButton></div>
    {selectedQuote ? <p className="md:col-span-4 rounded-xl border border-rapid-cyan/20 bg-rapid-cyan/10 px-3 py-2 text-sm text-rapid-cyan">Loaded from {selectedQuote.quote_number}. You can still edit client, invoice number, amount and due date before creating.</p> : null}
  </form>;
}
