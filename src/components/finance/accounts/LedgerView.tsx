"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Column } from "@/components/table/types";
import { useListParams } from "@/hooks/useListParams";
import { formatCurrency } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { Option } from "@/lib/types";
import type { LedgerResult, LedgerRow } from "@/server/services/finance/ledger.service";
import { methodLabel } from "../shared/FinanceBadges";
import { referenceHref } from "../shared/financeUi";
import { Amount, MoneyTile, StaticTable, TileGrid } from "../shared/FinanceWidgets";

/** Account picker kept in the URL (?account=). */
export function LedgerAccountSelect({ accounts, value }: { accounts: Option[]; value: string }) {
  const { update, isPending } = useListParams();
  return (
    <label className={`space-y-1 block w-full sm:w-64 ${isPending ? "opacity-60" : ""}`}>
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account</span>
      <select
        value={value}
        onChange={(e) => update({ account: e.target.value || undefined })}
        className="h-9 w-full px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand"
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Cash / bank book with running balance (Proserve ledger). */
export function LedgerView({ ledger }: { ledger: LedgerResult }) {
  const rows = useMemo<LedgerRow[]>(
    () => [
      {
        _id: "opening", date: ledger.from, paymentNo: "", party: "Opening balance", referenceType: "GENERAL", referenceId: null,
        reference: "", account: "", method: "", notes: "", in: 0, out: 0, balance: ledger.opening,
      },
      ...ledger.rows,
    ],
    [ledger]
  );

  const columns = useMemo<Column<LedgerRow>[]>(
    () => [
      { key: "date", label: "Date", render: (r) => <span className="whitespace-nowrap">{formatDay(r.date)}</span> },
      {
        key: "party",
        label: "Particulars",
        render: (r) =>
          r._id === "opening" ? (
            <span className="font-semibold">Opening balance</span>
          ) : (
            <span className="inline-flex flex-col">
              <span className="font-semibold text-slate-900">{r.party || r.notes || "—"}</span>
              <span className="text-[11px] text-slate-500 font-mono">{r.paymentNo}</span>
            </span>
          ),
      },
      {
        key: "reference",
        label: "Reference",
        render: (r) => {
          if (!r.reference) return "—";
          const href = referenceHref(r.referenceType, r.referenceId);
          return href ? (
            <Link href={href} className="font-mono font-semibold text-brand hover:underline">
              {r.reference}
            </Link>
          ) : (
            <span className="font-mono">{r.reference}</span>
          );
        },
      },
      ...(ledger.account ? [] : [{ key: "account", label: "Account", render: (r: LedgerRow) => r.account || "—" }]),
      { key: "method", label: "Method", render: (r) => (r.method ? methodLabel(r.method as never) : "") },
      { key: "in", label: "Money In", align: "right", render: (r) => <Amount value={r.in} tone="in" /> },
      { key: "out", label: "Money Out", align: "right", render: (r) => <Amount value={r.out} tone="out" /> },
      {
        key: "balance",
        label: "Balance",
        align: "right",
        render: (r) => <span className={`font-bold ${r.balance < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatCurrency(r.balance)}</span>,
      },
    ],
    [ledger.account]
  );

  const pad = ledger.account ? [] : [""];
  return (
    <>
      <TileGrid>
        <MoneyTile label="Opening" value={ledger.opening} hint={formatDay(ledger.from)} />
        <MoneyTile label="Money In" value={ledger.totalIn} tone="in" />
        <MoneyTile label="Money Out" value={ledger.totalOut} tone="out" />
        <MoneyTile label="Closing" value={ledger.closing} tone="brand" hint={formatDay(ledger.to)} />
      </TileGrid>
      <StaticTable
        rows={rows}
        columns={columns}
        itemName="entries"
        footer={["Totals", "", "", ...pad, "", formatCurrency(ledger.totalIn), formatCurrency(ledger.totalOut), formatCurrency(ledger.closing)]}
      />
    </>
  );
}
