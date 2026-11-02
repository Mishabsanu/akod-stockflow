"use client";

import type { ReactNode } from "react";
import { DataCardList } from "@/components/table/DataCardList";
import type { Column } from "@/components/table/types";
import { formatCurrency } from "@/lib/format";

const TONES = {
  neutral: "text-slate-900",
  in: "text-emerald-700",
  out: "text-rose-700",
  warn: "text-amber-700",
  brand: "text-brand",
};

/** Money headline tile: label, amount and an optional hint line. */
export function MoneyTile({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONES;
  hint?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs min-w-0 print:shadow-none">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{label}</p>
      <p className={`text-lg sm:text-xl font-black mt-0.5 tabular-nums truncate ${TONES[tone]}`}>{formatCurrency(value)}</p>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>;
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" };

/**
 * Non-paginated grid for reports and statements (rows are already the whole result).
 * Grid on tablets and up, cards on phones — the same look as DataTable.
 */
export function StaticTable<T extends { _id: string }>({
  rows,
  columns,
  itemName,
  footer,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  itemName: string;
  /** Totals row (cells aligned with columns) */
  footer?: ReactNode[];
  rowClassName?: (row: T) => string;
}) {
  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden print:border-slate-400">
      <div className="hidden md:block overflow-x-auto print:block">
        <table className="w-full text-xs">
          <thead className="bg-head border-b border-line">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap ${ALIGN[c.align ?? "left"]}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">
                  No {itemName} in this period
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row._id} className={`hover:bg-slate-50/70 ${rowClassName?.(row) ?? ""}`}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 align-top ${ALIGN[c.align ?? "left"]} ${c.mono ? "font-mono" : ""} ${c.align === "right" ? "tabular-nums whitespace-nowrap" : ""}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot className="bg-head border-t-2 border-line font-bold text-slate-900">
              <tr>
                {footer.map((cell, i) => (
                  <td key={i} className={`px-3 py-2 tabular-nums whitespace-nowrap ${ALIGN[columns[i]?.align ?? "left"]}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="md:hidden print:hidden">
        <DataCardList rows={rows} columns={columns} itemName={itemName} />
        {footer && rows.length > 0 && (
          <div className="border-t-2 border-line bg-head px-3 py-2.5 text-xs font-bold text-slate-900 flex flex-wrap gap-x-4 gap-y-1">
            {footer.map((cell, i) => (cell ? <span key={i}>{cell}</span> : null))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Amount in green (in) or red (out); blank for zero. */
export function Amount({ value, tone }: { value: number; tone: "in" | "out" | "neutral" }) {
  if (!value) return <span className="text-slate-300">—</span>;
  return <span className={`font-semibold ${tone === "in" ? "text-emerald-700" : tone === "out" ? "text-rose-700" : "text-slate-900"}`}>{formatCurrency(value)}</span>;
}
