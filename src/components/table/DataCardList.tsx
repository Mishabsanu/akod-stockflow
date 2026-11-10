"use client";

import { ChevronDown, ChevronRight, Database } from "lucide-react";
import type { ReactNode } from "react";
import type { Column } from "./types";

interface DataCardListProps<T extends { _id: string }> {
  rows: T[];
  columns: Column<T>[];
  itemName: string;
  rowActions?: (row: T) => ReactNode;
  /** Child rows (e.g. variants) listed inside the card when expanded */
  subRows?: (row: T) => T[] | undefined;
  subRowsLabel?: string;
  expanded?: Set<string>;
  onToggle?: (id: string) => void;
}

function cell<T>(col: Column<T>, row: T, sub = false): ReactNode {
  return col.render ? col.render(row, { sub }) : ((row as Record<string, unknown>)[col.key] as ReactNode) || "—";
}

function Card<T extends { _id: string }>({
  row,
  columns,
  rowActions,
  sub = false,
}: {
  row: T;
  columns: Column<T>[];
  rowActions?: (row: T) => ReactNode;
  sub?: boolean;
}) {
  const [title, ...fields] = columns;
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`min-w-0 text-[13px] font-semibold text-slate-900 ${title?.mono ? "font-mono" : ""}`}>
          {title && cell(title, row, sub)}
        </div>
        {rowActions && <div className="shrink-0 -mr-1">{rowActions(row)}</div>}
      </div>
      {fields.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
          {fields.map((col) => (
            <div key={col.key} className="min-w-0">
              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{col.label}</dt>
              <dd className={`text-xs text-slate-700 break-words ${col.mono ? "font-mono font-semibold" : ""}`}>{cell(col, row, sub)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/**
 * Phone layout of DataTable: one card per row. The first visible column is the card title,
 * the others are label / value pairs, and row actions sit in the card header.
 */
export function DataCardList<T extends { _id: string }>({
  rows,
  columns,
  itemName,
  rowActions,
  subRows,
  subRowsLabel = "rows",
  expanded,
  onToggle,
}: DataCardListProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-slate-400">
        <Database className="w-7 h-7 mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-600">No {itemName} found</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your filters or create a new entry</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const children = subRows?.(row) ?? [];
        const open = Boolean(expanded?.has(row._id));
        return (
          <li key={row._id} className="px-3 py-3 bg-white">
            <Card row={row} columns={columns} rowActions={rowActions} />
            {children.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => onToggle?.(row._id)}
                  aria-expanded={open}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand"
                >
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {open ? `Hide ${subRowsLabel}` : `Show ${children.length} ${subRowsLabel}`}
                </button>
                {open && (
                  <ul className="mt-2 space-y-2 border-l-2 border-brand-border pl-3">
                    {children.map((child) => (
                      <li key={child._id} className="rounded-lg border border-line bg-slate-50/70 p-2.5">
                        <Card row={child} columns={columns} rowActions={rowActions} sub />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
