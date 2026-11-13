import { ArrowLeft, Check, ClipboardList, Edit2, History, Package, Truck, User, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ORDER_TYPE_LABELS, type Order, type OrderStatus } from "@/lib/commerceTypes";
import type { Payment } from "@/lib/financeTypes";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { Option } from "@/lib/types";
import type { CompanySettings } from "@/lib/validation/setting.schema";
import { OrderActions } from "./OrderActions";
import { OrderStatusBadge, OrderTypeBadge, PaymentStatusBadge } from "./OrderBadges";
import { OrderSlipA6 } from "./OrderSlipA6";
import { ORDER_STATUS_LABELS, ORDER_UI } from "./orderConfig";
import { OrderPayments } from "./OrderPayments";
import { PrintButton } from "./PrintButton";
import { ShipmentCard } from "./ShipmentCard";

interface OrderDetailProps {
  order: Order;
  payments: Payment[];
  accounts: Option[];
  canUpdate: boolean;
  canPay: boolean;
  /** Printed above the order (print only) */
  company?: CompanySettings;
}

const FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED"];

/** Pending → Confirmed → Shipped → Delivered → Completed, with the time each step was reached. */
function StatusTracker({ order }: { order: Order }) {
  if (order.status === "CANCELLED" || order.status === "RETURNED") {
    const last = [...order.history].reverse().find((h) => h.status === order.status);
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs">
        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
        <div>
          <p className="font-bold text-rose-800">
            Order {ORDER_STATUS_LABELS[order.status].toLowerCase()}
            {last ? ` · ${formatDateTime(last.at)}${last.by ? ` · ${last.by}` : ""}` : ""}
          </p>
          <p className="text-rose-700 mt-0.5">
            {last?.note ? `Reason: ${last.note}. ` : ""}Stock from this order is back in inventory and its income is reversed.
          </p>
        </div>
      </div>
    );
  }
  const current = FLOW.indexOf(order.status);
  const reachedAt = (s: OrderStatus) => [...order.history].reverse().find((h) => h.status === s)?.at;
  return (
    <ol className="grid grid-cols-5 gap-1">
      {FLOW.map((s, i) => {
        const done = i <= current;
        const at = done ? reachedAt(s) : undefined;
        return (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute top-3.5 right-1/2 w-full h-0.5 ${i <= current ? "bg-brand" : "bg-slate-200"}`} aria-hidden />}
            <span
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 ${
                i === current
                  ? "bg-brand border-brand text-white ring-4 ring-brand/15"
                  : done
                    ? "bg-brand border-brand text-white"
                    : "bg-white border-slate-300 text-slate-400"
              }`}
            >
              {done && i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] font-bold ${done ? "text-slate-900" : "text-slate-400"}`}>{ORDER_STATUS_LABELS[s]}</span>
            <span className="text-[10px] text-slate-500 hidden sm:block">{at ? formatDateTime(at) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Tile({ label, value, tone = "default", hint }: { label: string; value: string; tone?: "default" | "good" | "bad" | "brand"; hint?: string }) {
  const color = { default: "text-slate-900", good: "text-emerald-700", bad: "text-rose-700", brand: "text-brand" }[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-black tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function SideCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <span className="text-brand">{icon}</span>
        <h2 className="text-xs font-bold text-brand uppercase tracking-wider">{title}</h2>
      </div>
      <dl className="px-4 py-3 space-y-2.5 text-xs">{children}</dl>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-right font-semibold text-slate-800 min-w-0 break-words ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

export function OrderDetail({ order, payments, accounts, canUpdate, canPay, company }: OrderDetailProps) {
  const qty = order.items.reduce((s, i) => s + i.quantity, 0);
  const closed = order.status === "CANCELLED" || order.status === "RETURNED";
  const counted = order.status !== "PENDING" && !closed;
  const partyTitle = order.orderType === "DISTRIBUTOR" ? "Distributor" : order.orderType === "MARKETPLACE" ? "Buyer" : "Customer";

  return (
    <>
      <OrderSlipA6 order={order} company={company} />
      <div className="print-a4 space-y-4">
      {company && (
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-2">
          <p className="text-lg font-bold text-slate-900">{company.companyName}</p>
          {company.address && <p className="text-xs text-slate-600 whitespace-pre-line">{company.address}</p>}
          <p className="text-xs text-slate-600">{[company.phone, company.email, company.gstin && `GSTIN ${company.gstin}`].filter(Boolean).join(" · ")}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link href={ORDER_UI.basePath} title="Back to orders" className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition shrink-0 print:hidden">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900 font-mono">{order.orderNo}</h1>
                <OrderTypeBadge type={order.orderType} />
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} orderStatus={order.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDay(order.orderDate)}
                {order.channel ? ` · ${order.channel.name}` : ""}
                {order.customerName ? ` · ${order.customerName}` : ""}
                {order.orderReference ? ` · Ref ${order.orderReference}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canUpdate && <OrderActions order={order} />}
            {canUpdate && order.status === "PENDING" && (
              <Link
                href={`${ORDER_UI.basePath}/${order._id}/edit`}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </Link>
            )}
            <PrintButton />
          </div>
        </div>
        <div className="px-4 sm:px-6 pb-5 pt-1 print:hidden">
          <StatusTracker order={order} />
        </div>
      </div>

      {/* Money at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Order Total" value={formatCurrency(order.total)} tone="brand" hint={`${order.items.length} lines`} />
        <Tile label="Paid" value={formatCurrency(order.paid)} tone={order.paid > 0 ? "good" : "default"} />
        <Tile
          label={closed && order.paid > 0 ? "Refund Due" : "Outstanding"}
          value={formatCurrency(closed ? Math.max(order.paid, 0) : counted ? order.outstanding : order.total)}
          tone={(closed ? order.paid > 0 : order.outstanding > 0) ? "bad" : "good"}
          hint={order.status === "PENDING" ? "Owed once confirmed" : order.dueDate && !closed ? `Due ${formatDay(order.dueDate)}` : undefined}
        />
        <Tile label="Units" value={formatNumber(qty)} hint={order.status === "PENDING" ? "Not deducted yet" : closed ? "Back in stock" : "Deducted from stock"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Items */}
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand" />
              <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Items</h2>
            </div>
            <span className="text-[11px] text-slate-500">
              {order.items.length} lines · {formatNumber(qty)} units
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-head text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left w-8">#</th>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((i, idx) => (
                  <tr key={`${i.product}-${idx}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-2 py-2.5 min-w-[160px]">
                      <Link href={`/dashboard/products/${i.product}`} className="block font-semibold text-slate-900 hover:text-brand">
                        {i.name}
                      </Link>
                      <span className="font-mono text-[11px] text-slate-500">{i.sku}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{formatNumber(i.quantity)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(i.price)}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatCurrency(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-slate-100">
            <dl className="w-full sm:w-80 text-xs divide-y divide-slate-100">
              <Total label="Subtotal" value={formatCurrency(order.subtotal)} />
              {order.discount > 0 && <Total label="Discount" value={`− ${formatCurrency(order.discount)}`} />}
              {order.tax > 0 && <Total label={`Tax (${order.taxPercent}%)`} value={formatCurrency(order.tax)} />}
              {order.shipping > 0 && <Total label="Shipping" value={formatCurrency(order.shipping)} />}
              <Total label="Total" value={formatCurrency(order.total)} strong />
              <Total label="Paid" value={formatCurrency(order.paid)} />
              {counted && (
                <Total label="Outstanding" value={<span className={order.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}>{formatCurrency(order.outstanding)}</span>} />
              )}
            </dl>
          </div>
          {order.notes && (
            <div className="px-4 py-3 border-t border-slate-100 text-xs">
              <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-slate-700 whitespace-pre-line">{order.notes}</p>
            </div>
          )}
        </section>

        {/* Side: order + party */}
        <div className="space-y-4">
          <SideCard title="Order Details" icon={<ClipboardList className="w-4 h-4" />}>
            <Row label="Order Type" value={ORDER_TYPE_LABELS[order.orderType]} />
            {order.orderType === "MARKETPLACE" && <Row label="Marketplace" value={order.channel?.name} />}
            <Row label={order.orderType === "MARKETPLACE" ? "Marketplace Order ID" : "Reference"} value={order.orderReference} mono />
            <Row label="Order Date" value={formatDay(order.orderDate)} />
            {order.dueDate && <Row label="Payment Due" value={formatDay(order.dueDate)} />}
            <Row label="Created By" value={order.createdBy?.name} />
            <Row label="Created" value={formatDateTime(order.createdAt)} />
          </SideCard>
          <SideCard title={partyTitle} icon={<User className="w-4 h-4" />}>
            <Row
              label="Name"
              value={
                order.customer ? (
                  <Link href={`/dashboard/orders/customers/${order.customer._id}`} className="text-brand hover:underline">
                    {order.customerName} ({order.customer.code})
                  </Link>
                ) : (
                  order.customerName
                )
              }
            />
            <Row label="Phone" value={order.customerPhone} />
            <Row label="Address" value={order.customerAddress} />
          </SideCard>
          {(order.courier || order.trackingNumber || order.shippedAt) && (
            <SideCard title="Delivery" icon={<Truck className="w-4 h-4" />}>
              <Row label="Courier" value={order.courier} />
              <Row label="Tracking No" value={order.trackingNumber} mono />
              <Row label="Shipped" value={order.shippedAt ? formatDateTime(order.shippedAt) : ""} />
              <Row label="Delivered" value={order.deliveredAt ? formatDateTime(order.deliveredAt) : ""} />
            </SideCard>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
        <ShipmentCard order={order} canEdit={canUpdate} />
        <OrderPayments order={order} payments={payments} accounts={accounts} canPay={canPay} />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print:hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-brand" />
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Status History</h2>
        </div>
        <ol className="p-4 space-y-0">
          {[...order.history].reverse().map((h, idx, all) => (
            <li key={idx} className="relative flex gap-3 text-xs pb-4 last:pb-0">
              {idx < all.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" aria-hidden />}
              <span className={`relative mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${idx === 0 ? "bg-brand ring-4 ring-brand/15" : "bg-slate-300"}`} />
              <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <OrderStatusBadge status={h.status} />
                <span className="text-slate-500">
                  {formatDateTime(h.at)}
                  {h.by ? ` · ${h.by}` : ""}
                </span>
                {h.note && <p className="basis-full text-[11px] text-slate-600">{h.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
      </div>
    </>
  );
}

function Total({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 ${strong ? "bg-brand-light/60" : ""}`}>
      <dt className={strong ? "font-bold text-slate-900" : "text-slate-600"}>{label}</dt>
      <dd className={strong ? "font-black text-brand text-sm" : "font-semibold text-slate-800"}>{value}</dd>
    </div>
  );
}
