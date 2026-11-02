"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { AttachedDocument, DocumentFolder } from "@/lib/documents";
import { apiRequest, ApiError } from "@/services/apiClient";
import { DocumentList } from "./DocumentList";

interface DocumentsPanelProps {
  title?: string;
  /** e.g. /api/delivery-notes/<id>/documents */
  saveUrl: string;
  folder: DocumentFolder;
  documents: AttachedDocument[];
  canEdit: boolean;
  nameSuggestions?: readonly string[];
  /** Max files (1 = single-file slot such as a signed note) */
  max?: number;
  /** Optional expiry date per document (worker documents) */
  withExpiry?: boolean;
}

/** Detail-page section: documents are saved on the record as soon as they are uploaded or removed. */
export function DocumentsPanel({ title = "Documents", saveUrl, folder, documents, canEdit, nameSuggestions, max, withExpiry }: DocumentsPanelProps) {
  const router = useRouter();
  const [list, setList] = useState(documents);
  const [saving, setSaving] = useState(false);

  const save = async (next: AttachedDocument[]) => {
    setSaving(true);
    try {
      const res = await apiRequest<{ documents: AttachedDocument[] }>(saveUrl, "PUT", { documents: next });
      setList(res.documents);
      toast.success(next.length > list.length ? "Document uploaded" : next.length < list.length ? "Document removed" : "Document updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save documents");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="no-print space-y-3">
      <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">
        {title} ({list.length})
      </h2>
      <DocumentList documents={list} folder={folder} onChange={canEdit ? save : undefined} busy={saving} nameSuggestions={nameSuggestions} max={max} withExpiry={withExpiry} />
    </section>
  );
}
