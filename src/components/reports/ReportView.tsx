"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { ReportColumn, ReportResult, ReportRow, ReportSummaryItem } from "@/lib/reportTypes";
import { ReportChart } from "@/components/charts/LazyCharts";

function renderCell(col: ReportColumn, row: ReportRow): ReactNode {
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span className="text-slate-300">—</span>;
  switch (col.format) {
    case "money":
      return <span className="tabular-nums">{formatCurrency(Number(v))}</span>;
    case "number":
      return <span className="tabular-nums">{formatNumber(Number(v))}</span>;
    case "signed": {
      const n = Number(v);
      const isMoney = col.key === "net";
      const text = isMoney ? formatCurrency(Math.abs(n)) : formatNumber(Math.abs(n));
      return (
        <span className={`tabular-nums font-semibold ${n > 0 ? "text-emerald-700" : n < 0 ? "text-rose-700" : "text-slate-500"}`}>
          {n > 0 ? "+" : n < 0 ? "−" : ""}
          {text}
        </span>
      );
    }
    case "date":
      return formatDay(String(v));
    case "badge":
      return <Badge variant={row.tone ?? "neutral"}>{String(v)}</Badge>;
    case "mono":
      return <span className="font-mono font-semibold text-slate-700">{String(v)}</span>;
    default:
      return String(v);
  }
}

const TONE = { in: "text-emerald-700", out: "text-rose-700", neutral: "text-slate-900" };

export function SummaryTiles({ items }: { items: ReportSummaryItem[] }) {
  if (!items.length) return null;
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${items.length >= 4 ? "lg:grid-cols-4" : "md:grid-cols-3"} ${items.length === 5 ? "xl:grid-cols-5" : ""}`}>
      {items.map((s) => (
        <div key={s.label} className="bg-white border border-line rounded-xl px-3.5 py-3 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{s.label}</p>
          <p className={`text-lg font-black tabular-nums mt-0.5 truncate ${TONE[s.tone ?? "neutral"]}`}>
            {s.format === "money" ? formatCurrency(s.value) : formatNumber(s.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Any report from the engine: summary tiles, optional chart and a server-paginated table. */
export function ReportView({ report, itemName = "rows" }: { report: ReportResult; itemName?: string }) {
  const columns = useMemo<Column<ReportRow>[]>(
    () =>
      report.columns.map((col, i) => ({
        key: col.key,
        label: col.label,
        align: col.align ?? (col.format === "money" || col.format === "number" || col.format === "signed" ? "right" : "left"),
        hiddenByDefault: col.hiddenByDefault,
        render: (row: ReportRow) => {
          const content =
            i === 0 && row.href ? (
              <Link href={row.href} className="font-semibold text-brand hover:underline">
                {renderCell(col, row)}
              </Link>
            ) : (
              renderCell(col, row)
            );
          // Statement totals (P&L) are bold
          return row.strong ? <span className="font-bold text-slate-900">{content}</span> : content;
        },
      })),
    [report.columns]
  );

  const filters = useMemo<FilterConfig[]>(() => {
    const list: FilterConfig[] = report.filters.map((f) => ({ ...f, minWidth: "160px" }));
    if (report.sorts.length > 1) {
      list.push({
        key: "sort",
        allLabel: `Sort: ${report.sorts[0].label}`,
        minWidth: "180px",
        options: report.sorts.slice(1).map((s) => ({ value: s.value, label: `Sort: ${s.label}` })),
      });
    }
    return list;
  }, [report.filters, report.sorts]);

  const hasActions = report.rows.items.some((r) => r.actionHref);

  return (
    <div className="space-y-4">
      <SummaryTiles items={report.summary} />
      {report.chart && <ReportChart chart={report.chart} />}
      <DataTable
        data={report.rows}
        columns={columns}
        itemName={itemName}
        searchPlaceholder={report.searchPlaceholder}
        filters={filters}
        rowActions={
          hasActions
            ? (row) =>
                row.actionHref ? (
                  <Link
                    href={row.actionHref}
                    className="inline-flex items-center h-7 px-2.5 rounded-md bg-brand hover:bg-brand-dark text-white text-[11px] font-bold"
                  >
                    {row.actionLabel ?? "Open"}
                  </Link>
                ) : null
            : undefined
        }
      />
    </div>
  );
}
