"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function labelForPath(path: string) {
  const segment = path.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment.replaceAll("-", " ").replace(/^./, (char) => char.toUpperCase());
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const [target, setTarget] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTarget(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname]);

  useEffect(() => {
    function showFor(path: string) {
      setTarget(path);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setTarget(null), 8000);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      showFor(url.pathname);
    }

    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!target) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div className="h-1 overflow-hidden bg-slate-950/80">
        <div className="h-full w-1/2 animate-[route-progress_1.1s_ease-in-out_infinite] rounded-r-full bg-gradient-to-r from-rapid-blue via-rapid-cyan to-white shadow-[0_0_24px_rgba(56,213,255,0.75)]" />
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-slate-950/85 px-4 py-2 text-xs font-semibold text-slate-200 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <span className="size-2 animate-pulse rounded-full bg-rapid-cyan shadow-[0_0_18px_rgba(56,213,255,0.9)]" />
        Loading {labelForPath(target)}…
      </div>
    </div>
  );
}
