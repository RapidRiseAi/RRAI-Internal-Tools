"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { clsx } from "clsx";

export function SubmitButton({ children, pendingLabel = "Saving…", forcePending = false, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingLabel?: string; forcePending?: boolean }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const clickResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = forcePending || pending || clicked;
  const disabled = busy || props.disabled;

  useEffect(() => {
    if (!pending && !forcePending) setClicked(false);
  }, [forcePending, pending]);

  useEffect(() => {
    return () => {
      if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
    };
  }, []);

  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      aria-busy={busy}
      aria-disabled={busy || props.disabled}
      disabled={disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;

        if (clicked && !pending && !forcePending) {
          event.preventDefault();
          return;
        }

        const form = event.currentTarget.form;
        if (!form || form.checkValidity()) {
          setClicked(true);
          if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
          clickResetTimer.current = setTimeout(() => setClicked(false), 30000);
        }
      }}
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
