"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { INCOME_CATEGORY_LABELS } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { Paginated } from "@/lib/types";
import type { IncomeRow } from "@/server/services/finance/income.service";
import { IncomeStatusBadge, methodLabel, PaymentStatusBadge } from "../shared/FinanceBadges";
import { FINANCE_PATHS, INCOME_CATEGORY_OPTIONS } from "../shared/financeUi";

const FILTERS: FilterConfig[] = [
  { key: "category", allLabel: "All Categories", options: INCOME_CATEGORY_OPTIONS, minWidth: "170px" },
  {
    key: "source",
    allLabel: "All Sources",
    options: [
      { value: "ORDER", label: "From orders" },
      { value: "MANUAL", label: "Manual (other)" },
    ],
  },
  {
    key: "status",
    allLabel: "All Status",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "REVERSED", label: "Reversed" },
    ],
  },
];

export function IncomeListView({ data }: { data: Paginated<IncomeRow> }) {
  const canDelete = usePermission("income", "delete");

  const columns = useMemo<Column<IncomeRow>[]>(
    () => [
      { key: "txnNo", label: "Income No", mono: true },
      { key: "txnDate", label: "Date", render: (r) => formatDay(r.txnDate) },
      {
        key: "category",
        label: "Category",
        render: (r) => <Badge variant={r.category === "OTHER_INCOME" ? "neutral" : "brand"}>{INCOME_CATEGORY_LABELS[r.category]}</Badge>,
      },
      {
        key: "description",
        label: "Description",
        render: (r) => (
          <span className="inline-flex flex-col max-w-[280px] whitespace-normal">
            {r.order ? (
              <Link href={`${FINANCE_PATHS.orders}/${r.order._id}`} className="font-mono font-semibold text-brand hover:underline">
                {r.order.orderNo}
              </Link>
            ) : null}
            <span className="text-slate-600">{r.description || "—"}</span>
          </span>
        ),
      },
      {
        key: "amount",
        label: "Amount",
        align: "right",
        render: (r) => (
          <span className={`font-semibold tabular-nums ${r.status === "REVERSED" ? "line-through text-slate-400" : "text-emerald-700"}`}>
            {formatCurrency(r.amount)}
          </span>
        ),
      },
      {
        key: "payment",
        label: "Payment",
        align: "center",
        render: (r) => (r.order ? <PaymentStatusBadge status={r.order.paymentStatus} /> : <span className="text-slate-600">{methodLabel(r.paymentMethod)}</span>),
      },
      { key: "referenceNo", label: "Reference", hiddenByDefault: true, render: (r) => r.referenceNo || "—" },
      { key: "source", label: "Source", align: "center", render: (r) => (r.source === "ORDER" ? "Order" : "Manual") },
      { key: "status", label: "Status", align: "center", render: (r) => <IncomeStatusBadge status={r.status} /> },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="income entries"
      searchPlaceholder="Search by income no, description, reference..."
      filters={FILTERS}
      rowActions={(row) => (
        <RowActions
          entityLabel="Income"
          itemName={`${row.txnNo} — ${formatCurrency(row.amount)}`}
          viewHref={row.order ? `${FINANCE_PATHS.orders}/${row.order._id}` : undefined}
          deleteUrl={canDelete && row.source === "MANUAL" ? `/api/finance/income/${row._id}` : undefined}
        />
      )}
    />
  );
}
