"use client";

import { useMemo } from "react";
import { StockLevelBadge, stockLevel } from "@/components/inventory/StockLevelBadge";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";
import { PRODUCT_UI } from "./productConfig";

export function ProductListView({ data, categories }: { data: Paginated<Product>; categories: string[] }) {
  const canEdit = usePermission("product", "update");
  const canDelete = usePermission("product", "delete");

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        key: "name",
        label: "Product",
        render: (r) => (
          <span className="inline-flex flex-col">
            <span className="font-semibold text-slate-900 whitespace-normal">{r.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{r.sku}</span>
          </span>
        ),
      },
      { key: "category", label: "Category", render: (r) => r.category || "—" },
      { key: "barcode", label: "Barcode", mono: true, hiddenByDefault: true, render: (r) => r.barcode || "—" },
      { key: "sellingPrice", label: "Selling Price", align: "right", render: (r) => formatCurrency(r.sellingPrice) },
      { key: "costPrice", label: "Cost Price", align: "right", render: (r) => formatCurrency(r.costPrice) },
      {
        key: "stock",
        label: "Stock",
        align: "right",
        render: (r) => <span className="font-bold text-slate-900">{formatNumber(r.stock ?? 0)}</span>,
      },
      {
        key: "level",
        label: "Stock Level",
        align: "center",
        render: (r) => <StockLevelBadge level={stockLevel(r.stock ?? 0, r.reorderLevel)} />,
      },
      { key: "reorderLevel", label: "Reorder Level", align: "right", hiddenByDefault: true, render: (r) => formatNumber(r.reorderLevel) },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
    ],
    []
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      STATUS_FILTER,
      { key: "category", allLabel: "All Categories", minWidth: "170px", options: categories.map((c) => ({ label: c, value: c })) },
    ],
    [categories]
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="products"
      searchPlaceholder="Search by SKU code, product name, barcode..."
      filters={filters}
      rowActions={(row) => (
        <RowActions
          entityLabel={PRODUCT_UI.label}
          itemName={`${row.sku} — ${row.name}`}
          viewHref={`${PRODUCT_UI.basePath}/${row._id}`}
          editHref={canEdit ? `${PRODUCT_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete ? `${PRODUCT_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}
