"use client";

import { Badge } from "@/components/ui/Badge";

export interface ImportPreviewRow {
  line: number;
  outcome: "created" | "updated" | "error";
  label?: string;
  detail?: string;
  message?: string;
}

export interface ImportResult {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
  rows: ImportPreviewRow[];
  ignored: string[];
}

const OUTCOME = {
  created: { label: "New", variant: "success" },
  updated: { label: "Update", variant: "info" },
  error: { label: "Error", variant: "danger" },
} as const;

/** Row-by-row outcome of an import (preview or final). */
export function ImportPreviewTable({ rows }: { rows: ImportPreviewRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-head text-[10px] uppercase tracking-wider text-slate-600">
          <tr>
            <th className="px-2.5 py-2 w-14">Row</th>
            <th className="px-2.5 py-2">Item</th>
            <th className="px-2.5 py-2 w-20">Result</th>
            <th className="px-2.5 py-2">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.line} className={r.outcome === "error" ? "bg-rose-50/50" : undefined}>
              <td className="px-2.5 py-1.5 font-mono text-slate-500">{r.line}</td>
              <td className="px-2.5 py-1.5 font-mono font-semibold text-slate-800 break-all">{r.label || "—"}</td>
              <td className="px-2.5 py-1.5">
                <Badge variant={OUTCOME[r.outcome].variant}>{OUTCOME[r.outcome].label}</Badge>
              </td>
              <td className={`px-2.5 py-1.5 ${r.outcome === "error" ? "text-rose-700 font-semibold" : "text-slate-600"}`}>
                {r.message || r.detail || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
