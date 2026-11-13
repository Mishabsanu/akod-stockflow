import type { Order } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { CompanySettings } from "@/lib/validation/setting.schema";

/**
 * A6 (105 × 148 mm) packing / shipping slip. Hidden on screen; shown only when "Print A6" is used
 * (html[data-print="a6"], see globals.css). Plain black-on-white so it prints well on any printer.
 */
export function OrderSlipA6({ order, company }: { order: Order; company?: CompanySettings }) {
  const qty = order.items.reduce((s, i) => s + i.quantity, 0);
  const closed = order.status === "CANCELLED" || order.status === "RETURNED";
  const toCollect = closed ? 0 : Math.max(0, order.total - order.paid);

  return (
    <div className="print-a6 hidden text-black bg-white" style={{ fontSize: "9pt", lineHeight: 1.3 }}>
      {/* Order no + date */}
      <div className="flex items-end justify-between border-b-2 border-black pb-1">
        <div>
          <p style={{ fontSize: "7pt" }} className="uppercase tracking-wider">
            Order{order.channel ? ` · ${order.channel.name}` : ""}
          </p>
          <p className="font-mono font-black" style={{ fontSize: "13pt" }}>
            {order.orderNo}
          </p>
        </div>
        <p className="text-right" style={{ fontSize: "8pt" }}>
          {formatDay(order.orderDate)}
          {order.orderReference && order.orderType === "MARKETPLACE" && <span className="block font-mono">{order.orderReference}</span>}
        </p>
      </div>

      {/* Ship to */}
      <div className="border-b border-black py-1.5">
        <p style={{ fontSize: "7pt" }} className="font-bold uppercase tracking-wider">
          Ship to
        </p>
        <p className="font-black" style={{ fontSize: "12pt" }}>
          {order.customerName || "—"}
        </p>
        {order.customerAddress && <p className="whitespace-pre-line">{order.customerAddress}</p>}
        {order.customerPhone && (
          <p className="font-bold" style={{ fontSize: "10.5pt" }}>
            Ph: {order.customerPhone}
          </p>
        )}
      </div>

      {/* Items */}
      <table className="w-full border-b border-black" style={{ fontSize: "8pt" }}>
        <thead>
          <tr className="border-b border-black">
            <th className="py-0.5 text-left font-bold">Item</th>
            <th className="py-0.5 text-right font-bold w-8">Qty</th>
            <th className="py-0.5 text-right font-bold w-16">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i, idx) => (
            <tr key={`${i.product}-${idx}`} style={{ breakInside: "avoid" }}>
              <td className="py-0.5 pr-1">{i.name}</td>
              <td className="py-0.5 text-right tabular-nums">{formatNumber(i.quantity)}</td>
              <td className="py-0.5 text-right tabular-nums">{formatCurrency(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <dl className="py-1 border-b border-black" style={{ fontSize: "8.5pt" }}>
        <SlipRow label={`Subtotal (${formatNumber(qty)} units)`} value={formatCurrency(order.subtotal)} />
        {order.discount > 0 && <SlipRow label="Discount" value={`− ${formatCurrency(order.discount)}`} />}
        {order.tax > 0 && <SlipRow label={`Tax (${order.taxPercent}%)`} value={formatCurrency(order.tax)} />}
        <SlipRow label="Delivery" value={order.shipping > 0 ? formatCurrency(order.shipping) : "Free"} />
        <SlipRow label="Total" value={formatCurrency(order.total)} strong />
      </dl>
      <div className="my-1.5 border-2 border-black px-2 py-1 text-center font-black" style={{ fontSize: "11pt" }}>
        {closed ? `ORDER ${order.status}` : toCollect > 0 ? `COLLECT ${formatCurrency(toCollect)}` : "PREPAID"}
      </div>

      {(order.courier || order.trackingNumber) && (
        <p style={{ fontSize: "8pt" }}>
          {order.courier && <b>{order.courier}</b>}
          {order.trackingNumber && <span className="font-mono"> · {order.trackingNumber}</span>}
        </p>
      )}

      {/* From */}
      {company && (
        <div className="mt-1 border-t border-black pt-1" style={{ fontSize: "7.5pt" }}>
          <p className="font-bold uppercase tracking-wider" style={{ fontSize: "6.5pt" }}>
            From
          </p>
          <p className="font-bold">{company.companyName}</p>
          {company.address && <p className="whitespace-pre-line">{company.address}</p>}
          <p>{[company.phone, company.gstin && `GSTIN ${company.gstin}`].filter(Boolean).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

function SlipRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-black" : ""}`} style={strong ? { fontSize: "10pt" } : undefined}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
