"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { clsx } from "clsx";

export function SubmitButton({ children, pendingLabel = "Saving…", forcePending = false, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingLabel?: string; forcePending?: boolean }) {
  const { pending } = useFormStatus();
  // A click-local loading state can disable the submitter before the browser
  // dispatches submit. Only become busy once the form or its owner is pending.
  const busy = forcePending || pending;
  const disabled = busy || props.disabled;

  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      aria-busy={busy}
      aria-disabled={busy || props.disabled}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition duration-150 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/10 disabled:text-deck-muted disabled:opacity-70 disabled:shadow-none disabled:hover:scale-100 disabled:active:scale-100 aria-busy:cursor-wait",
        className,
      )}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" /> : null}
      {busy ? pendingLabel : children}
    </button>
  );
}
