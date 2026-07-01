"use client";

import type { ReactNode } from "react";
import { SubmitButton } from "./submit-button";

// A submit button that asks for confirmation before letting the form's server
// action run. Used for consequential, hard-to-reverse actions (refunds, voids)
// so an accidental click can't reverse a partner's commission.
export function ConfirmSubmit({
  message,
  children,
  pendingLabel,
  className,
}: {
  message: string;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <SubmitButton
      pendingLabel={pendingLabel}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </SubmitButton>
  );
}
