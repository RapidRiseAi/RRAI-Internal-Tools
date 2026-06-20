"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Pencil, X } from "lucide-react";
import { clsx } from "clsx";
import type { FileRecord } from "@/lib/types";

type FileResourceLinkProps = {
  file: Pick<FileRecord, "filename" | "url" | "mime_type">;
  className?: string;
};

function fileKind(file: Pick<FileRecord, "filename" | "url" | "mime_type">) {
  const mime = file.mime_type ?? "";
  const name = file.filename.toLowerCase();
  const url = file.url.toLowerCase().split("?")[0];
  if (mime === "text/uri-list") return "link";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(name) || /\.(png|jpe?g|webp|gif|svg)$/.test(url)) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf") || url.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("text/") || /\.(txt|csv|md|json|xml|log)$/.test(name) || /\.(txt|csv|md|json|xml|log)$/.test(url)) return "text";
  if (/word|excel|spreadsheet|presentation|powerpoint|officedocument/.test(mime) || /\.(docx?|xlsx?|pptx?)$/.test(name) || /\.(docx?|xlsx?|pptx?)$/.test(url)) return "office";
  return "download";
}

export function FileResourceLink({ file, className }: FileResourceLinkProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [isEditingCopy, setIsEditingCopy] = useState(false);
  const kind = fileKind(file);
  const previewUrl = useMemo(() => {
    if (kind === "office") {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`;
    }
    return file.url;
  }, [file.url, kind]);

  useEffect(() => {
    if (kind !== "text" || !dialogRef.current?.open || text !== null || textError) return;
    fetch(file.url)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load this file for inline editing.");
        return response.text();
      })
      .then(setText)
      .catch((error: Error) => setTextError(error.message));
  }, [file.url, kind, text, textError]);

  function downloadEditedCopy() {
    if (text === null) return;
    const blob = new Blob([text], { type: file.mime_type ?? "text/plain" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={clsx(
          "flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3 text-left text-sm text-rapid-cyan transition hover:bg-white/[0.08] hover:text-cyan-200",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0" />
          <span className="truncate">{file.filename}</span>
        </span>
        <span className="text-xs text-slate-400">Open</span>
      </button>
      <dialog ref={dialogRef} className="fixed inset-0 m-auto h-[92vh] w-[min(96vw,1200px)] rounded-3xl border border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 backdrop:bg-slate-950/75">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/95 px-6 py-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-white">{file.filename}</h2><p className="text-xs text-slate-400">{file.mime_type ?? "External file"}</p></div>
          <div className="flex shrink-0 items-center gap-2">
            {kind === "text" ? <button type="button" onClick={() => setIsEditingCopy((value) => !value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"><Pencil className="mr-1 inline size-4" />Edit copy</button> : null}
            {kind !== "link" ? <a href={file.url} download className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"><Download className="mr-1 inline size-4" />Download</a> : null}
            <a href={file.url} target="_blank" rel="noreferrer" className="rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-3 py-2 text-sm font-semibold text-white"><ExternalLink className="mr-1 inline size-4" />Open tab</a>
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/10" aria-label="Close file viewer"><X className="size-4" /></button>
          </div>
        </div>
        <div className="h-[calc(92vh-73px)] overflow-auto p-4">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- File previews can be external signed URLs that are not known to next/image at build time.
            <img src={previewUrl} alt={file.filename} className="mx-auto max-h-full max-w-full rounded-2xl object-contain" />
          ) : null}
          {kind === "pdf" || kind === "office" ? <iframe title={file.filename} src={previewUrl} className="h-full w-full rounded-2xl border border-white/10 bg-white" /> : null}
          {kind === "text" ? (
            isEditingCopy ? <div className="grid h-full gap-3"><textarea value={text ?? ""} onChange={(event) => setText(event.target.value)} className="h-full min-h-[60vh] rounded-2xl border border-white/10 bg-slate-900 p-4 font-mono text-sm text-slate-100 outline-none" /><button type="button" onClick={downloadEditedCopy} className="w-fit rounded-xl bg-gradient-to-r from-rapid-blue to-rapid-cyan px-4 py-2 text-sm font-semibold text-white">Download edited copy</button></div> : <pre className="min-h-full whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-100">{textError ?? text ?? "Loading file…"}</pre>
          ) : null}
          {kind === "link" ? <iframe title={file.filename} src={file.url} className="h-full w-full rounded-2xl border border-white/10 bg-white" /> : null}
          {kind === "download" ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center"><p className="text-slate-300">Preview is not available for this file type. Open it in a new tab or download it.</p></div> : null}
        </div>
      </dialog>
    </>
  );
}
