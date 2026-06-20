"use client";

import { useRef, type ReactNode } from "react";
import { ExternalLink, Info, X } from "lucide-react";
import { clsx } from "clsx";

type RecordResourceLinkProps = {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  href?: string;
  children?: ReactNode;
  className?: string;
  actionLabel?: string;
};

export function RecordResourceLink({
  title,
  eyebrow,
  meta,
  href,
  children,
  className,
  actionLabel = "Open",
}: RecordResourceLinkProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasDetails = Boolean(children);

  if (!hasDetails && href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={clsx(
          "flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.08] hover:text-white",
          className,
        )}
      >
        <span className="min-w-0">
          {eyebrow ? <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-rapid-cyan">{eyebrow}</span> : null}
          <span className="block truncate font-semibold text-white">{title}</span>
          {meta ? <span className="mt-1 block text-slate-400">{meta}</span> : null}
        </span>
        <span className="shrink-0 text-xs text-rapid-cyan">{actionLabel}</span>
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={clsx(
          "flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.08] hover:text-white",
          className,
        )}
      >
        <span className="flex min-w-0 items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-rapid-cyan" />
          <span className="min-w-0">
            {eyebrow ? <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-rapid-cyan">{eyebrow}</span> : null}
            <span className="block truncate font-semibold text-white">{title}</span>
            {meta ? <span className="mt-1 block text-slate-400">{meta}</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-xs text-rapid-cyan">{actionLabel}</span>
      </button>
      <dialog ref={dialogRef} className="fixed inset-0 m-auto w-[min(96vw,900px)] max-h-[92vh] rounded-3xl border border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 backdrop:bg-slate-950/75">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/95 px-6 py-4">
          <div className="min-w-0">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rapid-cyan">{eyebrow}</p> : null}
            <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
            {meta ? <div className="mt-1 text-sm text-slate-400">{meta}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {href ? <a href={href} target="_blank" rel="noreferrer" className="rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-3 py-2 text-sm font-semibold text-white"><ExternalLink className="mr-1 inline size-4" />Open full</a> : null}
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/10" aria-label="Close details"><X className="size-4" /></button>
          </div>
        </div>
        <div className="max-h-[78vh] overflow-auto p-6">{children}</div>
      </dialog>
    </>
  );
}
