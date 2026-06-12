"use client";

import { useActionState } from "react";
import { LoginTransition } from "@/components/login-transition";
import { SubmitButton } from "@/components/submit-button";
import { Card, inputClass } from "@/components/ui";
import { loginAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_34rem)] px-6 py-10">
      <Card className="w-full max-w-5xl overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border-b border-white/10 bg-white/[0.03] p-8 lg:border-b-0 lg:border-r lg:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-rapid-cyan">Rapid Rise AI</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">Sign in to Rapid Rise OS</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Private command center for leads, clients, quotes, projects, billing, support, retainers and team execution.</p>
            <div className="mt-8 grid gap-3 text-sm text-slate-300">
              {[
                "Secure server-side session handling",
                "Role-based internal access",
                "Duplicate-safe workflow submissions",
              ].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">{item}</div>)}
            </div>
          </section>
          <section className="p-8 lg:p-10">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">Enter your employee credentials to continue to the dashboard.</p>
            <form action={formAction} className="mt-6 grid gap-4">
              <input className={inputClass} name="email" type="email" placeholder="owner@rapidrise.ai" autoComplete="email" required />
              <input className={inputClass} name="password" type="password" placeholder="Password" autoComplete="current-password" required />
              {state?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{state.error}</p> : null}
              <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
              <LoginTransition />
              <p className="text-xs leading-5 text-slate-500">The button will show progress while Rapid Rise OS verifies your details. If credentials are incorrect, it will unlock and show the error above.</p>
            </form>
          </section>
        </div>
      </Card>
    </main>
  );
}
