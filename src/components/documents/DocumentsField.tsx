"use client";

import { useField } from "formik";
import type { AttachedDocument, DocumentFolder } from "@/lib/documents";
import { DocumentList } from "./DocumentList";

/** Formik field: files are uploaded right away and saved with the record when the form is submitted. */
export function DocumentsField({
  name = "documents",
  folder,
  nameSuggestions,
  withExpiry,
}: {
  name?: string;
  folder: DocumentFolder;
  nameSuggestions?: readonly string[];
  withExpiry?: boolean;
}) {
  const [field, , helpers] = useField<AttachedDocument[]>(name);
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <DocumentList documents={field.value ?? []} folder={folder} onChange={(next) => void helpers.setValue(next)} nameSuggestions={nameSuggestions} withExpiry={withExpiry} />
    </div>
  );
}
