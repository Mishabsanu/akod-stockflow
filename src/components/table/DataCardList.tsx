"use client";

import { Database } from "lucide-react";
import type { ReactNode } from "react";
import type { Column } from "./types";

interface DataCardListProps<T extends { _id: string }> {
  rows: T[];
  columns: Column<T>[];
  itemName: string;
  rowActions?: (row: T) => ReactNode;
}

function cell<T>(col: Column<T>, row: T): ReactNode {
  return col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as ReactNode) || "—";
}

/**
 * Phone layout of DataTable: one card per row. The first visible column is the card title,
 * the others are label / value pairs, and row actions sit in the card header.
 */
export function DataCardList<T extends { _id: string }>({ rows, columns, itemName, rowActions }: DataCardListProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-slate-400">
        <Database className="w-7 h-7 mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-600">No {itemName} found</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your filters or create a new entry</p>
      </div>
    );
  }

  const [title, ...fields] = columns;

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row._id} className="px-3 py-3 bg-white">
          <div className="flex items-start justify-between gap-2">
            <div className={`min-w-0 text-[13px] font-semibold text-slate-900 ${title?.mono ? "font-mono" : ""}`}>
              {title && cell(title, row)}
            </div>
            {rowActions && <div className="shrink-0 -mr-1">{rowActions(row)}</div>}
          </div>
          {fields.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              {fields.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{col.label}</dt>
                  <dd className={`text-xs text-slate-700 break-words ${col.mono ? "font-mono font-semibold" : ""}`}>
                    {cell(col, row)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
