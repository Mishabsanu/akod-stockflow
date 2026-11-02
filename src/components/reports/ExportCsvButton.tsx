"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";

/** CSV download of the report with the filters currently on screen (every page, not just this one). */
export function ExportCsvButton({ reportKey }: { reportKey: string }) {
  const search = useSearchParams();
  const qs = new URLSearchParams(search.toString());
  qs.delete("page");
  qs.delete("limit");
  const base = `/api/reports/${reportKey}/export`;
  return (
    <a
      href={qs.toString() ? `${base}?${qs}` : base}
      className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
      title="Download as CSV (uses the current filters)"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </a>
  );
}
