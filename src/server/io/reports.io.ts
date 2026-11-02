import "server-only";
import { NextResponse } from "next/server";
import type { ReportColumn, ReportResult } from "@/lib/reportTypes";

/** RFC 4180 cell: quoted when it holds a comma, quote or newline. Formula-looking text is neutralised. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value) : String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function value(col: ReportColumn, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === "") return "";
  if (col.format === "money" && typeof raw === "number") return raw.toFixed(2);
  return raw;
}

/** CSV with a header row: same columns as the screen (hidden ones included). */
export function reportToCsv(report: ReportResult): string {
  const header = report.columns.map((c) => cell(c.label)).join(",");
  const lines = report.rows.items.map((r) => report.columns.map((c) => cell(value(c, r[c.key]))).join(","));
  return [header, ...lines].join("\r\n");
}

export function csvResponse(csv: string, filename: string): NextResponse {
  // BOM so Excel opens ₹ and other UTF-8 text correctly
  return new NextResponse(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const reportFileName = (report: ReportResult) => {
  const stamp = report.range
    ? `${report.range.from}_to_${report.range.to}`
    : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return `${report.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${stamp}.csv`;
};
