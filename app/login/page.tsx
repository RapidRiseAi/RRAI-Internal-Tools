"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginTransition } from "@/components/login-transition";
import { SubmitButton } from "@/components/submit-button";
import { Card, inputClass, LinkButton } from "@/components/ui";
import { loginAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [successTransition, setSuccessTransition] = useState(false);
  const router = useRouter();
  const loginSucceeded = successTransition || Boolean(state?.success);

  useEffect(() => {
    if (!state?.success) return;

    setSuccessTransition(true);
    const timer = setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 950);

    return () => clearTimeout(timer);
  }, [router, state]);

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
              <input className={inputClass} name="email" type="email" placeholder="owner@rapidrise.ai" autoComplete="email" disabled={loginSucceeded} required />
              <input className={inputClass} name="password" type="password" placeholder="Password" autoComplete="current-password" disabled={loginSucceeded} required />
              {state?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{state.error}</p> : null}
              <SubmitButton forcePending={loginSucceeded} pendingLabel={loginSucceeded ? "Opening dashboard…" : "Verifying credentials…"}>Sign in</SubmitButton>
              <LoginTransition active={loginSucceeded} />
              <div className="relative my-1 text-center text-xs uppercase tracking-[0.2em] text-slate-500">or</div>
              <LinkButton href="/api/auth/google/start?mode=login" variant="ghost">Sign in with Google</LinkButton>
              <p className="text-xs leading-5 text-slate-500">The button stays in verification mode until Rapid Rise OS receives the login result. Google sign-in only works for active employee emails already approved in Rapid Rise OS.</p>
            </form>
            {pending && !loginSucceeded ? <p className="mt-4 rounded-2xl border border-rapid-cyan/20 bg-rapid-cyan/10 px-4 py-3 text-xs font-semibold text-rapid-cyan">Checking credentials securely…</p> : null}
          </section>
        </div>
      </Card>
    </main>
  );
}
