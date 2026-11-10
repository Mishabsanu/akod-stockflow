"use client";

import { useField } from "formik";
import { X } from "lucide-react";
import { useState } from "react";
import { FormField, inputClass } from "@/components/ui/FormField";
import { BATCH_CODE_PATTERN, parseBatchCodes, sortBatchCodes } from "@/lib/batchCodeTypes";

/** Chips editor for batch codes: type "27" + Enter, a list "27, 28, 29", or a range "27-33". */
export function BatchCodesField({ name = "batchCodes" }: { name?: string }) {
  const [field, meta, helpers] = useField<string[]>(name);
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState("");
  const codes = field.value ?? [];
  const error = localError || (meta.touched || meta.error?.includes("belong") ? (meta.error as string | undefined) : undefined);

  const add = () => {
    const parsed = parseBatchCodes(text);
    if (parsed.length === 0) return;
    const bad = parsed.find((c) => !BATCH_CODE_PATTERN.test(c));
    if (bad) {
      setLocalError(`"${bad}" is not valid — letters and numbers only, up to 10`);
      return;
    }
    setLocalError("");
    void helpers.setValue(sortBatchCodes([...new Set([...codes, ...parsed])]));
    void helpers.setTouched(true, false);
    setText("");
  };

  return (
    <FormField
      label="Batch Codes"
      htmlFor={`${name}-input`}
      required
      error={error}
      hint={codes.length ? `${codes.length} code(s)` : "Enter adds · 27, 28 or 27-33"}
      className="sm:col-span-2"
    >
      <div className="flex gap-2">
        <input
          id={`${name}-input`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="e.g. 27 or 27-33"
          autoComplete="off"
          className={`${inputClass(Boolean(error))} uppercase font-mono`}
        />
      </div>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {codes.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-brand-light border border-brand-border text-brand text-xs font-bold font-mono">
              {c}
              <button
                type="button"
                onClick={() => void helpers.setValue(codes.filter((x) => x !== c))}
                className="w-5 h-5 rounded-full hover:bg-brand hover:text-white flex items-center justify-center"
                aria-label={`Remove ${c}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </FormField>
  );
}
