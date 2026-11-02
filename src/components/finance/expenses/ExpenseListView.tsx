"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig } from "@/components/table/types";
import { EXPENSE_CATEGORY_LABELS, type Expense } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { formatDay, todayIST } from "@/lib/indiaDate";
import type { Paginated } from "@/lib/types";
import { ExpenseStatusBadge } from "../shared/FinanceBadges";
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_STATUS_OPTIONS } from "../shared/financeUi";
import type { ExpenseFormOptions } from "./ExpenseFormModal";
import { ExpenseRowActions } from "./ExpenseRowActions";

export function ExpenseListView({ data, options }: { data: Paginated<Expense>; options: ExpenseFormOptions }) {
  const filters = useMemo<FilterConfig[]>(
    () => [
      { key: "status", allLabel: "All Status", options: EXPENSE_STATUS_OPTIONS },
      { key: "category", allLabel: "All Categories", options: EXPENSE_CATEGORY_OPTIONS, minWidth: "170px" },
      ...(options.channels.length ? [{ key: "channel", allLabel: "All Marketplaces", options: options.channels }] : []),
    ],
    [options.channels]
  );

  const columns = useMemo<Column<Expense>[]>(() => {
    const today = todayIST();
    return [
      { key: "expenseNo", label: "Expense No", mono: true },
      { key: "expenseDate", label: "Date", render: (r) => formatDay(r.expenseDate) },
      { key: "category", label: "Category", render: (r) => EXPENSE_CATEGORY_LABELS[r.category] },
      {
        key: "payeeName",
        label: "Payee / Description",
        render: (r) => (
          <span className="inline-flex flex-col max-w-[260px] whitespace-normal">
            <span className="font-semibold text-slate-900">{r.payeeName || "—"}</span>
            {(r.description || r.channel) && (
              <span className="text-[11px] text-slate-500">
                {[r.channel?.name, r.description].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
        ),
      },
      { key: "amount", label: "Amount", align: "right", render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.amount)}</span> },
      { key: "paid", label: "Paid", align: "right", render: (r) => <span className="tabular-nums text-emerald-700">{r.paid ? formatCurrency(r.paid) : "—"}</span> },
      {
        key: "balance",
        label: "Balance",
        align: "right",
        render: (r) => <span className={`font-semibold tabular-nums ${r.balance ? "text-rose-700" : "text-slate-400"}`}>{r.balance ? formatCurrency(r.balance) : "—"}</span>,
      },
      {
        key: "dueDate",
        label: "Due",
        render: (r) =>
          r.dueDate ? (
            <span className={r.balance && r.dueDate < today ? "font-semibold text-rose-700" : ""}>{formatDay(r.dueDate)}</span>
          ) : (
            "—"
          ),
      },
      { key: "referenceNo", label: "Reference", hiddenByDefault: true, render: (r) => r.referenceNo || "—" },
      { key: "status", label: "Status", align: "center", render: (r) => <ExpenseStatusBadge status={r.status} /> },
    ];
  }, []);

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="expenses"
      searchPlaceholder="Search by expense no, payee, description, reference..."
      filters={filters}
      rowActions={(row) => <ExpenseRowActions expense={row} options={options} />}
    />
  );
}
