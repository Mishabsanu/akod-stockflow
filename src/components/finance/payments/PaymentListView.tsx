"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig } from "@/components/table/types";
import type { Payment } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { Option, Paginated } from "@/lib/types";
import { DirectionBadge, methodLabel } from "../shared/FinanceBadges";
import { METHOD_OPTIONS, REFERENCE_TYPE_LABELS, referenceHref } from "../shared/financeUi";

export function PaymentListView({ data, accounts }: { data: Paginated<Payment>; accounts: Option[] }) {
  const canDelete = usePermission("payment", "delete");

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        key: "direction",
        allLabel: "Received & Made",
        options: [
          { value: "RECEIVED", label: "Received" },
          { value: "MADE", label: "Made" },
        ],
      },
      {
        key: "referenceType",
        allLabel: "All Types",
        options: Object.entries(REFERENCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      },
      { key: "method", allLabel: "All Methods", options: METHOD_OPTIONS },
      { key: "account", allLabel: "All Accounts", options: accounts, minWidth: "170px" },
    ],
    [accounts]
  );

  const columns = useMemo<Column<Payment>[]>(
    () => [
      { key: "paymentNo", label: "Payment No", mono: true },
      { key: "paymentDate", label: "Date", render: (r) => formatDay(r.paymentDate) },
      { key: "direction", label: "Type", align: "center", render: (r) => <DirectionBadge direction={r.direction} /> },
      {
        key: "reference",
        label: "For",
        render: (r) => {
          const href = referenceHref(r.referenceType, r.referenceId);
          return (
            <span className="inline-flex flex-col">
              <span className="text-[11px] text-slate-500">{REFERENCE_TYPE_LABELS[r.referenceType]}</span>
              {r.referenceLabel ? (
                href ? (
                  <Link href={href} className="font-mono font-semibold text-brand hover:underline">
                    {r.referenceLabel}
                  </Link>
                ) : (
                  <span className="font-mono font-semibold">{r.referenceLabel}</span>
                )
              ) : null}
            </span>
          );
        },
      },
      { key: "partyName", label: "Party", render: (r) => r.partyName || "—" },
      {
        key: "amount",
        label: "Amount",
        align: "right",
        render: (r) => (
          <span className={`font-semibold tabular-nums ${r.direction === "RECEIVED" ? "text-emerald-700" : "text-rose-700"}`}>
            {r.direction === "RECEIVED" ? "+" : "−"} {formatCurrency(r.amount)}
          </span>
        ),
      },
      { key: "method", label: "Method", render: (r) => methodLabel(r.method) },
      { key: "account", label: "Account", render: (r) => r.account?.name ?? "—" },
      { key: "transactionRef", label: "Txn Ref", hiddenByDefault: true, mono: true, render: (r) => r.transactionRef || "—" },
      { key: "notes", label: "Notes", hiddenByDefault: true, render: (r) => r.notes || "—" },
      { key: "createdBy", label: "Entered By", hiddenByDefault: true, render: (r) => r.createdBy?.name ?? "—" },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="payments"
      searchPlaceholder="Search payment no, party, order / expense no, reference..."
      filters={filters}
      rowActions={(row) =>
        canDelete && row.referenceType !== "INCOME" ? (
          <RowActions
            entityLabel="Payment"
            itemName={`${row.paymentNo} — ${formatCurrency(row.amount)}${row.referenceLabel ? ` (re-opens ${row.referenceLabel})` : ""}`}
            deleteUrl={`/api/payments/${row._id}`}
          />
        ) : (
          <span className="text-slate-300">—</span>
        )
      }
    />
  );
}
