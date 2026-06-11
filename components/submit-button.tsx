"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { clsx } from "clsx";

export function SubmitButton({ children, pendingLabel = "Saving…", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const sawPending = useRef(false);
  const busy = pending || clicked;

  useEffect(() => {
    if (pending) sawPending.current = true;
    if (!pending && sawPending.current) {
      setClicked(false);
      sawPending.current = false;
    }
  }, [pending]);

  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      aria-busy={busy}
      disabled={busy || props.disabled}
      onClick={(event) => {
        props.onClick?.(event);
        const form = event.currentTarget.form;
        if (!event.defaultPrevented && (!form || form.checkValidity())) setClicked(true);
      }}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition duration-150 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 disabled:active:scale-100",
        className,
      )}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" /> : null}
      {busy ? pendingLabel : children}
    </button>
  );
}
