"use client";

import { Layers } from "lucide-react";
import { useMemo } from "react";
import { stockLevel } from "@/components/inventory/StockLevelBadge";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import type { StockLevel } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";
import { ProductThumb } from "./ProductImages";
import { PRODUCT_UI } from "./productConfig";

const LEVEL_STYLE: Record<StockLevel, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOW_STOCK: "bg-amber-50 text-amber-700 border-amber-200",
  OUT_OF_STOCK: "bg-rose-50 text-rose-700 border-rose-200",
};

/** "400 UNITS", coloured by stock level. */
function UnitsBadge({ qty, level }: { qty: number; level: StockLevel }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10.5px] font-bold uppercase tracking-wide ${LEVEL_STYLE[level]}`}>
      {formatNumber(qty)} units
    </span>
  );
}

const rupees = (n: number) => formatCurrency(n).replace(/\.00$/, "");

/** ₹160 – ₹640 across a product's variants. */
function priceRange(variants: Product[]) {
  const prices = variants.map((v) => v.sellingPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? rupees(min) : `${rupees(min)} – ${rupees(max)}`;
}

/** Variant rows store "Parent - Variant"; the list shows the parent part and the variant separately. */
function baseName(v: Product) {
  const suffix = v.variantName ? ` - ${v.variantName}` : "";
  return suffix && v.name.endsWith(suffix) ? v.name.slice(0, -suffix.length) : v.name;
}

export function ProductListView({ data, categories }: { data: Paginated<Product>; categories: string[] }) {
  const canEdit = usePermission("product", "update");
  const canDelete = usePermission("product", "delete");

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        key: "sku",
        label: "SKU Code",
        render: (r, { sub }) => (
          <span className={`font-mono font-semibold ${sub ? "text-[11px] text-slate-500" : "text-slate-800"}`}>{r.sku}</span>
        ),
      },
      {
        key: "name",
        label: "Product Name",
        render: (r, { sub }) =>
          sub ? (
            <span className="inline-flex items-center gap-2 whitespace-normal">
              {r.images?.[0] ? <ProductThumb image={r.images[0]} size={24} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />}
              <span className="text-slate-700">
                {baseName(r)} <span className="text-slate-400">({r.variantName})</span>
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2.5">
              <ProductThumb image={r.images?.[0]} size={34} />
              <span className="font-semibold text-slate-900 whitespace-normal">{r.name}</span>
              {r.variants?.length ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                  <Layers className="w-3 h-3" />
                  {r.variants.length} Var
                </span>
              ) : null}
            </span>
          ),
      },
      { key: "category", label: "Category", render: (r, { sub }) => (sub ? "—" : r.category || "—") },
      {
        key: "variant",
        label: "Variant / Size",
        render: (r, { sub }) =>
          sub ? (
            <span className="inline-flex px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700">
              {r.variantName}
            </span>
          ) : r.variants?.length ? (
            <span className="text-slate-600">{r.variants.length} SKU Sizes</span>
          ) : (
            "—"
          ),
      },
      { key: "barcode", label: "Barcode", mono: true, hiddenByDefault: true, render: (r) => r.barcode || "—" },
      {
        key: "sellingPrice",
        label: "Price",
        align: "right",
        render: (r) => <span className="font-bold text-slate-900">{r.variants?.length ? priceRange(r.variants) : rupees(r.sellingPrice)}</span>,
      },
      {
        key: "mrp",
        label: "MRP",
        align: "right",
        render: (r) => {
          const list = r.variants?.length ? r.variants.map((v) => v.mrp ?? 0) : [r.mrp ?? 0];
          const set = list.filter((n) => n > 0);
          if (set.length === 0) return "—";
          const min = Math.min(...set);
          const max = Math.max(...set);
          return <span className="text-slate-500">{min === max ? rupees(min) : `${rupees(min)} – ${rupees(max)}`}</span>;
        },
      },
      {
        key: "costPrice",
        label: "Cost Price",
        align: "right",
        hiddenByDefault: true,
        render: (r) => (r.variants?.length ? "—" : formatCurrency(r.costPrice)),
      },
      {
        key: "stock",
        label: "Stock Level",
        align: "center",
        render: (r) => {
          const reorder = r.variants?.length ? r.variants.reduce((n, v) => n + v.reorderLevel, 0) : r.reorderLevel;
          return <UnitsBadge qty={r.stock ?? 0} level={stockLevel(r.stock ?? 0, reorder)} />;
        },
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
      searchPlaceholder="Search product, SKU, variant, barcode, category..."
      filters={filters}
      subRows={(row) => row.variants}
      subRowsLabel="variants"
      rowActions={(row) =>
        row.parent ? (
          // Variants are edited and removed on their product's form
          <RowActions
            entityLabel="Variant"
            itemName={`${row.sku} — ${row.name}`}
            viewHref={`${PRODUCT_UI.basePath}/${row._id}`}
            editHref={canEdit ? `${PRODUCT_UI.basePath}/${row.parent}/edit` : undefined}
          />
        ) : (
          <RowActions
            entityLabel={PRODUCT_UI.label}
            itemName={`${row.sku} — ${row.name}${row.variants?.length ? ` and its ${row.variants.length} variants` : ""}`}
            viewHref={`${PRODUCT_UI.basePath}/${row._id}`}
            editHref={canEdit ? `${PRODUCT_UI.basePath}/${row._id}/edit` : undefined}
            deleteUrl={canDelete ? `${PRODUCT_UI.apiBase}/${row._id}` : undefined}
          />
        )
      }
    />
  );
}
