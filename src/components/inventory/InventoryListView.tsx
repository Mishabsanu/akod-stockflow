"use client";

import { Eye, PackagePlus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import type { InventoryRow } from "@/lib/commerceTypes";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { StockAdjustModal, type AdjustTarget } from "./StockAdjustModal";
import { STOCK_LEVEL_OPTIONS, StockLevelBadge } from "./StockLevelBadge";

const iconBtn = "p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light transition-colors";

const SORT_FILTER: FilterConfig = {
  key: "sort",
  allLabel: "Sort: Name",
  minWidth: "150px",
  options: [
    { value: "qty_asc", label: "Stock: low → high" },
    { value: "qty_desc", label: "Stock: high → low" },
    { value: "value", label: "Stock value" },
    { value: "sku", label: "SKU" },
  ],
};

interface InventoryListViewProps {
  data: Paginated<InventoryRow>;
  categories: string[];
  /** Low Stock page: the level filter is fixed */
  alertsOnly?: boolean;
}

export function InventoryListView({ data, categories, alertsOnly = false }: InventoryListViewProps) {
  const canAdd = usePermission("stock", "create");
  const canAdjust = usePermission("stock", "update");
  const [target, setTarget] = useState<AdjustTarget | null>(null);

  const columns = useMemo<Column<InventoryRow>[]>(
    () => [
      {
        key: "product",
        label: "Product",
        render: (r) => (
          <span className="inline-flex flex-col">
            <span className="font-semibold text-slate-900 whitespace-normal">{r.product.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{r.product.sku}</span>
          </span>
        ),
      },
      { key: "category", label: "Category", render: (r) => r.product.category || "—" },
      {
        key: "quantity",
        label: "Available",
        align: "right",
        render: (r) => <span className="text-sm font-black text-slate-900">{formatNumber(r.quantity)}</span>,
      },
      { key: "reorderLevel", label: "Reorder Level", align: "right", render: (r) => formatNumber(r.product.reorderLevel) },
      { key: "level", label: "Level", align: "center", render: (r) => <StockLevelBadge level={r.level} /> },
      { key: "costPrice", label: "Cost", align: "right", hiddenByDefault: true, render: (r) => formatCurrency(r.product.costPrice) },
      { key: "stockValue", label: "Stock Value", align: "right", render: (r) => formatCurrency(r.stockValue) },
      { key: "lastMovementAt", label: "Last Movement", hiddenByDefault: true, render: (r) => formatDateTime(r.lastMovementAt) },
      {
        key: "status",
        label: "Product",
        align: "center",
        hiddenByDefault: true,
        render: (r) => (r.product.status === "active" ? "Active" : "Inactive"),
      },
    ],
    []
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      ...(alertsOnly ? [] : [{ key: "level", allLabel: "All Levels", minWidth: "140px", options: STOCK_LEVEL_OPTIONS }]),
      { key: "category", allLabel: "All Categories", minWidth: "160px", options: categories.map((c) => ({ label: c, value: c })) },
      { ...STATUS_FILTER, allLabel: "All Products" },
      SORT_FILTER,
    ],
    [alertsOnly, categories]
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName={alertsOnly ? "low-stock products" : "products"}
        searchPlaceholder="Search by SKU code, product name, barcode..."
        filters={filters}
        rowActions={(r) => (
          <div className="flex items-center justify-center gap-1.5">
            <Link href={`/dashboard/products/${r.product._id}`} title="View product" className={iconBtn}>
              <Eye className="w-3.5 h-3.5" />
            </Link>
            {canAdd && r.product.status === "active" && (
              <Link href={`/dashboard/inventory/update?product=${r.product._id}`} title="Add stock" className={iconBtn}>
                <PackagePlus className="w-3.5 h-3.5" />
              </Link>
            )}
            {canAdjust && (
              <button
                type="button"
                title="Adjust stock"
                className={iconBtn}
                onClick={() => setTarget({ _id: r.product._id, sku: r.product.sku, name: r.product.name, quantity: r.quantity })}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />
      <StockAdjustModal target={target} onClose={() => setTarget(null)} />
    </>
  );
}
