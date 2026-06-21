"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { LoginTransition } from "@/components/login-transition";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, LinkButton } from "@/components/ui";
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
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="rr-glass rr-brackets w-full max-w-5xl overflow-hidden rounded-3xl">
        <span className="rr-bracket tl" /><span className="rr-bracket tr" /><span className="rr-bracket bl" /><span className="rr-bracket br" />
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rr-scan relative border-b border-white/10 bg-white/[0.02] p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="flex items-center gap-3">
              <div className="rr-action grid size-11 place-items-center rounded-2xl text-sm font-black text-white">RR</div>
              <p className="rr-hud text-[0.7rem] font-semibold text-rapid-cyan">Rapid Rise AI</p>
            </div>
            <h1 className="mt-7 text-4xl font-bold tracking-tight text-white rr-neon-text">Sign in to Rapid Rise OS</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Private command center for leads, clients, quotes, projects, billing, support, retainers and team execution.</p>
            <div className="mt-8 grid gap-3 text-sm text-slate-300">
              {([
                [ShieldCheck, "Secure server-side session handling"],
                [Fingerprint, "Role-based internal access"],
                [Sparkles, "Duplicate-safe workflow submissions"],
              ] as [LucideIcon, string][]).map(([Icon, item]) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-rapid-cyan/25 bg-rapid-cyan/10 text-rapid-cyan">
                    <Icon className="size-4" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </section>
          <section className="p-8 lg:p-10">
            <p className="rr-hud flex items-center gap-2 text-[0.6rem] font-semibold text-rapid-cyan"><span className="rr-dot !size-1.5" /> Secure access</p>
            <h2 className="mt-3 text-xl font-semibold text-white">Welcome back</h2>
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
      </div>
    </main>
  );
}
