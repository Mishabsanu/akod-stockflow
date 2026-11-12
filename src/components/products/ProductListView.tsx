"use client";

import { ChevronDown, ChevronUp, EyeOff, Layers, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { stockLevel } from "@/components/inventory/StockLevelBadge";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import type { StockLevel } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { applyOffer } from "@/lib/validation/offer.schema";
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

function range(values: number[]) {
  const set = values.filter((n) => n > 0);
  if (set.length === 0) return "—";
  const min = Math.min(...set);
  const max = Math.max(...set);
  return min === max ? rupees(min) : `${rupees(min)} – ${rupees(max)}`;
}

/** Variant rows store "Parent - Variant"; the list shows the parent part and the pack separately. */
function baseName(v: Product) {
  const suffix = v.variantName ? ` - ${v.variantName}` : "";
  return suffix && v.name.endsWith(suffix) ? v.name.slice(0, -suffix.length) : v.name;
}

const sizeChip = "inline-flex px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700";

export function ProductListView({ data, categories, flavors }: { data: Paginated<Product>; categories: string[]; flavors: string[] }) {
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
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span className="text-slate-700">
                {baseName(r)} <span className="text-slate-400">({r.variantName} pack)</span>
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2.5 max-w-[22rem]">
              <ProductThumb image={r.images?.[0]} size={34} />
              <Link href={`${PRODUCT_UI.basePath}/${r._id}`} className="font-semibold text-slate-900 hover:text-brand truncate" title={r.name}>
                {r.name}
              </Link>
              {r.variants?.length ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                  <Layers className="w-3 h-3" />
                  {r.variants.length} Var
                </span>
              ) : null}
              {r.freeDelivery && (
                <span title="Free delivery" className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 shrink-0">
                  <Truck className="w-3 h-3" />
                </span>
              )}
              {(r.displayOrder ?? 0) > 0 && (
                <span title="Display order on the store" className="inline-flex items-center text-slate-700 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 shrink-0 font-mono text-[10px]">
                  #{r.displayOrder}
                </span>
              )}
              {r.storefrontVisible === false && (
                <span title="Hidden on storefront" className="inline-flex items-center text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 shrink-0">
                  <EyeOff className="w-3 h-3" />
                </span>
              )}
            </span>
          ),
      },
      {
        key: "displayOrder",
        label: "Store Order",
        align: "center",
        render: (r, { sub }) =>
          sub ? (
            "—"
          ) : (r.displayOrder ?? 0) > 0 ? (
            <span className="inline-flex min-w-8 justify-center rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">#{r.displayOrder}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      { key: "category", label: "Category", render: (r, { sub }) => (sub ? "—" : <span className="uppercase">{r.category || "—"}</span>) },
      { key: "flavorProfile", label: "Flavor Profile", render: (r, { sub }) => (sub ? "—" : r.flavorProfile || "—") },
      {
        key: "variant",
        label: "Variant / Size",
        render: (r, { sub, open, toggle }) =>
          sub ? (
            <span className={sizeChip}>{r.variantName}</span>
          ) : r.variants?.length ? (
            <button type="button" onClick={toggle} className="inline-flex items-center gap-1 text-slate-600 hover:text-brand" aria-expanded={open}>
              {r.variants.length} SKU Sizes
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            "—"
          ),
      },
      {
        key: "sellingPrice",
        label: "Price",
        align: "right",
        render: (r) => {
          const prices = r.variants?.length ? r.variants.map((v) => v.sellingPrice) : [r.sellingPrice];
          const o = r.liveOffer;
          if (!o) return <span className="font-bold text-slate-900">{range(prices)}</span>;
          return (
            <span className="inline-flex flex-col items-end leading-tight">
              <span className="font-bold text-emerald-700">{range(prices.map((p) => applyOffer(p, o)))}</span>
              <span className="text-[11px] text-slate-400 line-through">{range(prices)}</span>
            </span>
          );
        },
      },
      {
        key: "liveOffer",
        label: "Offer",
        render: (r, { sub }) =>
          sub ? (
            "—"
          ) : r.liveOffer ? (
            <span className="inline-flex max-w-[220px] flex-col" title={r.liveOffer.name}>
              <span className="inline-flex w-fit items-center rounded bg-emerald-600 px-1.5 py-0.5 text-[10.5px] font-bold text-white">{r.liveOffer.label}</span>
              <span className="truncate text-[11px] text-slate-600">{r.liveOffer.name}</span>
              {r.liveOffer.endDate && <span className="text-[10.5px] text-slate-400">until {formatDay(r.liveOffer.endDate)}</span>}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        key: "mrp",
        label: "MRP",
        align: "right",
        hiddenByDefault: true,
        render: (r) => <span className="text-slate-500">{range(r.variants?.length ? r.variants.map((v) => v.mrp ?? 0) : [r.mrp ?? 0])}</span>,
      },
      { key: "costPrice", label: "Cost Price", align: "right", hiddenByDefault: true, render: (r) => (r.variants?.length ? "—" : formatCurrency(r.costPrice)) },
      { key: "barcode", label: "Barcode", mono: true, hiddenByDefault: true, render: (r) => r.barcode || "—" },
      {
        key: "stock",
        label: "Stock Level",
        align: "center",
        render: (r) => {
          const reorder = r.variants?.length ? r.variants.reduce((n, v) => n + v.reorderLevel, 0) : r.reorderLevel;
          return <UnitsBadge qty={r.stock ?? 0} level={stockLevel(r.stock ?? 0, reorder)} />;
        },
      },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
    ],
    []
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      STATUS_FILTER,
      { key: "category", allLabel: "All Categories", minWidth: "160px", options: categories.map((c) => ({ label: c, value: c })) },
      ...(flavors.length ? [{ key: "flavor", allLabel: "All Flavors", minWidth: "140px", options: flavors.map((f) => ({ label: f, value: f })) }] : []),
      {
        key: "freeDelivery",
        allLabel: "All Delivery",
        minWidth: "140px",
        options: [
          { label: "Free Delivery", value: "yes" },
          { label: "Paid Delivery", value: "no" },
        ],
      },
    ],
    [categories, flavors]
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="products"
      searchPlaceholder="Search product, SKU ID, flavor, category..."
      filters={filters}
      subRows={(row) => row.variants}
      subRowsLabel="variants"
      rowActions={(row) =>
        row.parent ? (
          // Variants are edited on their product's form
          <RowActions entityLabel="Variant" itemName={`${row.sku} — ${row.name}`} editHref={canEdit ? `${PRODUCT_UI.basePath}/${row.parent}/edit` : undefined} />
        ) : (
          <RowActions
            entityLabel={PRODUCT_UI.label}
            itemName={`${row.sku} — ${row.name}${row.variants?.length ? ` and its ${row.variants.length} variants` : ""}`}
            editHref={canEdit ? `${PRODUCT_UI.basePath}/${row._id}/edit` : undefined}
            deleteUrl={canDelete ? `${PRODUCT_UI.apiBase}/${row._id}` : undefined}
          />
        )
      }
    />
  );
}
