"use client";

import { useEffect } from "react";
import { markThreadReadAction } from "@/lib/actions";

/** Marks a direct-message thread read when opened (only when there's something unread). */
export function MarkThreadRead({ to, enabled }: { to: string; enabled: boolean }) {
  useEffect(() => {
    if (enabled && to) markThreadReadAction(to).catch(() => {});
  }, [to, enabled]);
  return null;
}
