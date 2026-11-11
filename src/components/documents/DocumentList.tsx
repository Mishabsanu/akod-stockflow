"use client";

import { FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { DOCUMENT_ACCEPT, formatBytes, isImageDocument, MAX_DOCUMENTS, type AttachedDocument, type DocumentFolder } from "@/lib/documents";
import { uploadDirect } from "./directUpload";

/**
 * Uploads files straight to Cloudinary (3 at a time, photos shrunk first); the caller decides where
 * the returned documents are saved. No size limit from this server, since files never pass through it.
 */
export async function uploadFiles(files: File[], folder: DocumentFolder): Promise<AttachedDocument[]> {
  return Promise.all(files.map((f) => uploadDirect(f, folder)));
}

interface DocumentListProps {
  documents: AttachedDocument[];
  folder: DocumentFolder;
  /** Called with the full new list after an upload or a removal; omit for read-only */
  onChange?: (next: AttachedDocument[]) => Promise<void> | void;
  busy?: boolean;
  /** Quick picks for the name box, e.g. ["Bill", "UPI screenshot"] */
  nameSuggestions?: readonly string[];
  max?: number;
  /** Button text, e.g. "Upload Proof" */
  uploadLabel?: string;
  emptyText?: string;
  /** Expiry date per file (not used in this app yet; accepted so shared callers type-check) */
  withExpiry?: boolean;
}

/** File picker + list of attached files (open in a new tab, remove). Proofs are images or PDFs. */
export function DocumentList({
  documents,
  folder,
  onChange,
  busy,
  nameSuggestions = [],
  max = MAX_DOCUMENTS,
  uploadLabel = "Upload Proof",
  emptyText = "No proof attached.",
}: DocumentListProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const listId = useId();
  const editable = Boolean(onChange);
  const full = documents.length >= max;

  const pick = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!files.length || !onChange) return;
    if (documents.length + files.length > max) {
      toast.error(max === 1 ? "Only one file can be attached here" : `At most ${max} files`);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFiles(files, folder);
      // The typed name replaces the file name (numbered when several files are picked)
      const name = docName.trim().slice(0, 180);
      const named = uploaded.map((d, i) => ({ ...d, name: name ? (uploaded.length > 1 ? `${name} (${i + 1})` : name) : d.name }));
      await onChange([...documents, ...named]);
      setDocName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {editable && !full && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            list={nameSuggestions.length ? listId : undefined}
            maxLength={180}
            placeholder="Name (optional), e.g. Bill"
            aria-label="Proof name"
            className="h-9 w-full sm:w-56 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          {nameSuggestions.length > 0 && (
            <datalist id={listId}>
              {nameSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          <input ref={input} type="file" multiple={max > 1} accept={DOCUMENT_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
          <Button type="button" variant="outline" icon={<Upload className="w-4 h-4" />} loading={uploading} disabled={busy} onClick={() => input.current?.click()}>
            {uploading ? "Uploading..." : uploadLabel}
          </Button>
          <span className="text-[11px] text-slate-500">Photo, screenshot or PDF · max 10 MB</span>
        </div>
      )}
      {documents.length === 0 ? (
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-lg bg-white">
          {documents.map((d) => {
            const Icon = isImageDocument(d) ? ImageIcon : FileText;
            return (
              <li key={d.publicId} className="flex items-center gap-3 px-3 py-2 text-xs">
                <Icon className="w-4 h-4 text-brand shrink-0" />
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline truncate min-w-0">
                  {d.name}
                </a>
                <span className="ml-auto text-slate-500 whitespace-nowrap hidden sm:inline">
                  {[formatBytes(d.size), d.uploadedAt ? formatDate(d.uploadedAt) : ""].filter(Boolean).join(" · ")}
                </span>
                {editable && (
                  <button
                    type="button"
                    disabled={busy || uploading}
                    onClick={() => onChange?.(documents.filter((x) => x.publicId !== d.publicId))}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 shrink-0"
                    title="Remove"
                    aria-label={`Remove ${d.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Compact paperclip links for tables and lists. */
export function ProofLinks({ documents }: { documents?: AttachedDocument[] }) {
  if (!documents?.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {documents.map((d, i) => (
        <a
          key={d.publicId}
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={d.name}
          className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-brand-border bg-brand-light text-brand text-[11px] font-semibold hover:bg-brand hover:text-white"
        >
          <Paperclip className="w-3 h-3" />
          {documents.length > 1 ? i + 1 : "Proof"}
        </a>
      ))}
    </span>
  );
}
