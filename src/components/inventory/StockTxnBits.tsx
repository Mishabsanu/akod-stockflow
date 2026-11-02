import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { STOCK_TXN_LABELS, type StockTransaction, type StockTxnType } from "@/lib/commerceTypes";
import { formatDate, formatNumber } from "@/lib/format";

const TYPE_VARIANTS: Record<StockTxnType, BadgeVariant> = {
  STOCK_IN: "success",
  ADJUSTMENT_IN: "info",
  ADJUSTMENT_OUT: "warning",
  ORDER_OUT: "brand",
  ORDER_CANCEL: "neutral",
  ORDER_RETURN: "neutral",
};

export function StockTxnTypeBadge({ type }: { type: StockTxnType }) {
  return <Badge variant={TYPE_VARIANTS[type]}>{STOCK_TXN_LABELS[type]}</Badge>;
}

/** "+50" in green / "−12" in red. */
export function StockChange({ change }: { change: number }) {
  return (
    <span className={`font-bold font-mono ${change > 0 ? "text-emerald-700" : "text-rose-700"}`}>
      {change > 0 ? "+" : "−"}
      {formatNumber(Math.abs(change))}
    </span>
  );
}

/** Compact read-only list of movements (product detail page). Cards on phones, table from md. */
export function StockTxnMiniTable({ rows }: { rows: StockTransaction[] }) {
  if (!rows.length) return <p className="text-xs text-slate-500 py-3">No stock movements yet.</p>;
  return (
    <>
      <ul className="md:hidden divide-y divide-line border border-line rounded-lg">
        {rows.map((t) => (
          <li key={t._id} className="p-3 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <StockTxnTypeBadge type={t.type} />
              <StockChange change={t.change} />
            </div>
            <p className="text-slate-600">
              {formatDate(t.txnDate)} · {formatNumber(t.before)} → <b>{formatNumber(t.after)}</b>
              {t.poNumber ? ` · PO ${t.poNumber}` : ""}
              {t.reference ? ` · ${t.reference}` : ""}
            </p>
            {t.reason && <p className="text-slate-500">{t.reason}</p>}
          </li>
        ))}
      </ul>
      <div className="hidden md:block overflow-x-auto border border-line rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-head text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              {["Date", "Txn No", "Type", "Change", "Before → After", "PO / Reference", "Reason", "By"].map((h) => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((t) => (
              <tr key={t._id}>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.txnDate)}</td>
                <td className="px-3 py-2 font-mono">{t.txnNo}</td>
                <td className="px-3 py-2">
                  <StockTxnTypeBadge type={t.type} />
                </td>
                <td className="px-3 py-2">
                  <StockChange change={t.change} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatNumber(t.before)} → <b>{formatNumber(t.after)}</b>
                </td>
                <td className="px-3 py-2 font-mono">{[t.poNumber && `PO ${t.poNumber}`, t.reference].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">{t.reason || "—"}</td>
                <td className="px-3 py-2">{t.createdBy?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
