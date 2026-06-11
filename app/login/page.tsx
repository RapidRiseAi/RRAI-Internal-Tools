"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, inputClass } from "@/components/ui";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  return <main className="grid min-h-screen place-items-center px-6"><Card className="w-full max-w-md"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.3em] text-rapid-cyan">Rapid Rise AI</p><h1 className="mt-3 text-3xl font-bold text-white">Sign in to Rapid Rise OS</h1><p className="mt-2 text-sm text-slate-400">Private internal CRM, projects, support and finance operating system.</p></div><form action={formAction} className="grid gap-4"><input className={inputClass} name="email" type="email" placeholder="owner@rapidrise.ai" required /><input className={inputClass} name="password" type="password" placeholder="Password" required />{state?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{state.error}</p> : null}<SubmitButton disabled={pending} pendingLabel="Signing in…">Sign in</SubmitButton></form></Card></main>;
}
