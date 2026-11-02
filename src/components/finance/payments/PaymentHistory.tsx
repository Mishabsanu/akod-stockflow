"use client";

import { useMemo } from "react";
import type { Column } from "@/components/table/types";
import type { Payment } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { DirectionBadge, methodLabel } from "../shared/FinanceBadges";
import { StaticTable } from "../shared/FinanceWidgets";

/**
 * Payments linked to one order / expense, oldest first (Proserve settlement table).
 * Exported for the order detail page as well.
 */
export function PaymentHistory({ payments, title = "Payment history", emptyText }: { payments: Payment[]; title?: string; emptyText?: string }) {
  const columns = useMemo<Column<Payment>[]>(
    () => [
      { key: "paymentDate", label: "Date", render: (r) => formatDay(r.paymentDate) },
      { key: "paymentNo", label: "Payment No", mono: true },
      { key: "direction", label: "Type", render: (r) => <DirectionBadge direction={r.direction} /> },
      { key: "method", label: "Method", render: (r) => methodLabel(r.method) },
      { key: "account", label: "Account", render: (r) => r.account?.name ?? "—" },
      { key: "transactionRef", label: "Reference", render: (r) => r.transactionRef || "—" },
      { key: "createdBy", label: "By", render: (r) => r.createdBy?.name ?? "—" },
      { key: "amount", label: "Amount", align: "right", render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    ],
    []
  );
  const total = payments.reduce((s, p) => s + (p.direction === "RECEIVED" ? p.amount : -p.amount), 0);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {payments.length === 0 && emptyText ? (
        <p className="bg-white border border-line rounded-lg px-4 py-6 text-center text-xs text-slate-500">{emptyText}</p>
      ) : (
        <StaticTable rows={payments} columns={columns} itemName="payments" footer={["Total", "", "", "", "", "", "", formatCurrency(Math.abs(total))]} />
      )}
    </section>
  );
}
