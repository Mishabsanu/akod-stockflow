"use client";

import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CornerDownRight, Database } from "lucide-react";
import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import { useListParams } from "@/hooks/useListParams";
import type { Paginated } from "@/lib/types";
import { DataCardList } from "./DataCardList";
import { TableFilterBar } from "./TableFilterBar";
import { TablePagination } from "./TablePagination";
import type { Column, FilterConfig } from "./types";

interface DataTableProps<T extends { _id: string }> {
  data: Paginated<T>;
  columns: Column<T>[];
  itemName: string;
  searchPlaceholder: string;
  filters?: FilterConfig[];
  rowActions?: (row: T) => ReactNode;
  /** Child rows shown under a row when it is expanded (chevron in the first column), e.g. product variants */
  subRows?: (row: T) => T[] | undefined;
  /** Label for the Expand All button, e.g. "variants" */
  subRowsLabel?: string;
  /** Show child rows open on load (user can still collapse them) */
  defaultExpanded?: boolean;
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" };

/**
 * Server-paginated grid. Rows come from the server page; search, filters and paging
 * only change the URL, which makes the server render the next result set.
 * Below md the same rows render as cards (DataCardList) so phones never scroll sideways.
 */
export function DataTable<T extends { _id: string }>({
  data,
  columns,
  itemName,
  searchPlaceholder,
  filters = [],
  rowActions,
  subRows,
  subRowsLabel = "rows",
  defaultExpanded = false,
}: DataTableProps<T>) {
  const { get, update, isPending } = useListParams();
  const [visibleKeys, setVisibleKeys] = useState(
    () => new Set(columns.filter((c) => !c.hiddenByDefault).map((c) => c.key))
  );

  const activeColumns = useMemo(() => columns.filter((c) => visibleKeys.has(c.key)), [columns, visibleKeys]);
  const filterValues = useMemo(
    () => Object.fromEntries(filters.map((f) => [f.key, get(f.key)])),
    [filters, get]
  );

  const toggleColumn = useCallback((key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const showAllColumns = useCallback(() => setVisibleKeys(new Set(columns.map((c) => c.key))), [columns]);
  const onSearch = useCallback((value: string) => update({ search: value }), [update]);
  const onFilterChange = useCallback((key: string, value: string) => update({ [key]: value }), [update]);
  const onPageChange = useCallback((page: number) => update({ page: page > 1 ? page : undefined }), [update]);
  const onLimitChange = useCallback((limit: number) => update({ limit: limit === 10 ? undefined : limit }), [update]);

  const colSpan = activeColumns.length + (rowActions ? 1 : 0);

  // Rows the user flipped away from the default (open or closed), so new pages follow the default too
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const parentIds = useMemo(
    () => (subRows ? data.items.filter((r) => (subRows(r)?.length ?? 0) > 0).map((r) => r._id) : []),
    [data.items, subRows]
  );
  const expanded = useMemo(
    () => new Set(parentIds.filter((id) => (defaultExpanded ? !flipped.has(id) : flipped.has(id)))),
    [parentIds, flipped, defaultExpanded]
  );
  const allExpanded = parentIds.length > 0 && parentIds.every((id) => expanded.has(id));
  const toggleRow = useCallback((id: string) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = () => {
    const openAll = !allExpanded;
    // Open all = nothing flipped when open is the default, everything flipped otherwise (and the reverse to close)
    setFlipped(openAll === defaultExpanded ? new Set() : new Set(parentIds));
  };

  const expandAllButton =
    parentIds.length > 0 ? (
      <button
        type="button"
        onClick={toggleAll}
        className="flex items-center justify-center gap-1.5 px-3 py-2 md:py-0 w-full text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-head"
        title={allExpanded ? `Hide all ${subRowsLabel}` : `Show all ${subRowsLabel}`}
      >
        {allExpanded ? <ChevronsDownUp className="w-3.5 h-3.5 text-brand" /> : <ChevronsUpDown className="w-3.5 h-3.5 text-brand" />}
        {allExpanded ? "Collapse All" : "Expand All"}
      </button>
    ) : undefined;

  const renderRow = (row: T, sub: boolean) => {
    const children = !sub && subRows ? subRows(row) ?? [] : [];
    const open = expanded.has(row._id);
    return (
      <tr key={row._id} className={`transition-colors ${sub ? "bg-slate-50/70 hover:bg-head" : open ? "bg-brand-light/30 hover:bg-head" : "hover:bg-head"}`}>
        {activeColumns.map((col, i) => {
          const ctx = { sub, open, toggle: children.length > 0 ? () => toggleRow(row._id) : undefined };
          const content = col.render ? col.render(row, ctx) : ((row as Record<string, unknown>)[col.key] as ReactNode) || "—";
          const first = i === 0 && Boolean(subRows);
          return (
            <td
              key={col.key}
              className={`${sub ? "py-1.5" : "py-2"} px-3 align-middle border-r border-line whitespace-nowrap ${ALIGN[col.align || "left"]} ${
                col.mono ? "font-mono font-semibold text-slate-700" : "text-slate-700"
              }`}
            >
              {first ? (
                <span className={`inline-flex items-center gap-1.5 ${sub ? "pl-5" : ""}`}>
                  {sub ? (
                    <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : children.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleRow(row._id)}
                      aria-expanded={open}
                      aria-label={open ? `Hide ${subRowsLabel}` : `Show ${subRowsLabel}`}
                      title={open ? `Hide ${subRowsLabel}` : `Show ${children.length} ${subRowsLabel}`}
                      className="p-0.5 -ml-1 rounded text-slate-500 hover:text-brand hover:bg-brand-light"
                    >
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  {content}
                </span>
              ) : (
                content
              )}
            </td>
          );
        })}
        {rowActions && <td className="px-3 py-1.5 align-middle text-center whitespace-nowrap">{rowActions(row)}</td>}
      </tr>
    );
  };

  return (
    <div className="w-full bg-white border border-line text-slate-800 relative">
      <TableFilterBar
        search={get("search")}
        onSearch={onSearch}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={onFilterChange}
        columns={columns}
        visibleKeys={visibleKeys}
        onToggleColumn={toggleColumn}
        onShowAllColumns={showAllColumns}
        total={data.total}
        actions={expandAllButton}
      />

      <div className={`md:hidden border-t border-line relative transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {isPending && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand animate-pulse" />}
        <DataCardList
          rows={data.items}
          columns={activeColumns}
          itemName={itemName}
          rowActions={rowActions}
          subRows={subRows}
          subRowsLabel={subRowsLabel}
          expanded={expanded}
          onToggle={toggleRow}
        />
      </div>

      <div
        className={`hidden md:block w-full border-t border-line overflow-x-auto relative transition-opacity ${isPending ? "opacity-50" : ""}`}
      >
        {isPending && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand animate-pulse" />}
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-3 py-2 border-r border-line whitespace-nowrap ${ALIGN[col.align || "left"]}`}
                >
                  {col.label}
                </th>
              ))}
              {rowActions && <th className="w-28 px-3 py-2 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white text-slate-800">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-400">
                  <Database className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No {itemName} found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your filters or create a new entry</p>
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <Fragment key={row._id}>
                  {renderRow(row, false)}
                  {expanded.has(row._id) && (subRows?.(row) ?? []).map((child) => renderRow(child, true))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        totalPages={data.totalPages}
        itemName={itemName}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
