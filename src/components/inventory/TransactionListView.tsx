"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig } from "@/components/table/types";
import { STOCK_TXN_LABELS, STOCK_TXN_TYPES, type StockTransaction } from "@/lib/commerceTypes";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { StockChange, StockTxnTypeBadge } from "./StockTxnBits";

const TYPE_FILTER: FilterConfig = {
  key: "type",
  allLabel: "All Types",
  minWidth: "160px",
  options: STOCK_TXN_TYPES.map((t) => ({ value: t, label: STOCK_TXN_LABELS[t] })),
};

const SORT_FILTER: FilterConfig = {
  key: "sort",
  allLabel: "Newest first",
  minWidth: "140px",
  options: [
    { value: "oldest", label: "Oldest first" },
    { value: "date", label: "By txn date" },
  ],
};

export function TransactionListView({ data }: { data: Paginated<StockTransaction> }) {
  const columns = useMemo<Column<StockTransaction>[]>(
    () => [
      { key: "txnDate", label: "Date", render: (t) => formatDate(t.txnDate) },
      { key: "txnNo", label: "Txn No", mono: true },
      { key: "type", label: "Type", render: (t) => <StockTxnTypeBadge type={t.type} /> },
      {
        key: "product",
        label: "Product",
        render: (t) =>
          t.product ? (
            <Link href={`/dashboard/products/${t.product._id}`} className="inline-flex flex-col hover:text-brand">
              <span className="font-semibold text-slate-900 whitespace-normal">{t.product.name}</span>
              <span className="font-mono text-[11px] text-slate-500">{t.product.sku}</span>
            </Link>
          ) : (
            <span className="font-mono">—</span>
          ),
      },
      { key: "change", label: "Change", align: "right", render: (t) => <StockChange change={t.change} /> },
      { key: "before", label: "Before", align: "right", render: (t) => formatNumber(t.before) },
      { key: "after", label: "After", align: "right", render: (t) => <b>{formatNumber(t.after)}</b> },
      { key: "poNumber", label: "PO Number", mono: true, render: (t) => t.poNumber || "—" },
      {
        key: "reference",
        label: "Reference",
        mono: true,
        render: (t) =>
          t.order && t.reference ? (
            <Link href={`/dashboard/orders/${t.order}`} className="text-brand hover:underline">
              {t.reference}
            </Link>
          ) : (
            t.reference || "—"
          ),
      },
      { key: "reason", label: "Reason / Note", render: (t) => <span className="whitespace-normal">{t.reason || "—"}</span> },
      { key: "source", label: "Source", hiddenByDefault: true, render: (t) => t.source.toUpperCase() },
      { key: "createdBy", label: "By", render: (t) => t.createdBy?.name ?? "—" },
      { key: "createdAt", label: "Recorded", hiddenByDefault: true, render: (t) => formatDateTime(t.createdAt) },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="stock transactions"
      searchPlaceholder="Search SKU, txn no, PO number, order no..."
      filters={[TYPE_FILTER, SORT_FILTER]}
    />
  );
}
