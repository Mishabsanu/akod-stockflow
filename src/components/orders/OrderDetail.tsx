import { ArrowLeft, ClipboardList, Edit2, History } from "lucide-react";
import Link from "next/link";
import { DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { ORDER_TYPE_LABELS, type Order } from "@/lib/commerceTypes";
import type { Payment } from "@/lib/financeTypes";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { Option } from "@/lib/types";
import type { CompanySettings } from "@/lib/validation/setting.schema";
import { OrderActions } from "./OrderActions";
import { OrderStatusBadge, OrderTypeBadge, PaymentStatusBadge } from "./OrderBadges";
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

export function OrderDetail({ order, payments, accounts, canUpdate, canPay, company }: OrderDetailProps) {
  const backHref = ORDER_UI.basePath;
  const qty = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-4">
      {company && (
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-2">
          <p className="text-lg font-bold text-slate-900">{company.companyName}</p>
          {company.address && <p className="text-xs text-slate-600 whitespace-pre-line">{company.address}</p>}
          <p className="text-xs text-slate-600">
            {[company.phone, company.email, company.gstin && `GSTIN ${company.gstin}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link href={backHref} title="Back to orders" className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition shrink-0 print:hidden">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-9 h-9 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
              <ClipboardList className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-slate-900 font-mono">{order.orderNo}</h1>
                <OrderTypeBadge type={order.orderType} />
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} orderStatus={order.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDay(order.orderDate)}
                {order.channel ? ` · ${order.channel.name}` : ""}
                {order.customerName ? ` · ${order.customerName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canUpdate && <OrderActions order={order} />}
            {canUpdate && order.status === "DRAFT" && (
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

        <div className="p-4 sm:p-6 space-y-6">
          <DetailSection title="Order">
            <DetailItem label="Order Type" value={ORDER_TYPE_LABELS[order.orderType]} />
            {order.orderType === "MARKETPLACE" && <DetailItem label="Marketplace" value={order.channel?.name} />}
            <DetailItem label={order.orderType === "MARKETPLACE" ? "Marketplace Order ID" : "Reference"} value={order.orderReference} mono />
            <DetailItem label="Order Date" value={formatDay(order.orderDate)} />
            <DetailItem label="Payment Due" value={order.dueDate ? formatDay(order.dueDate) : ""} />
            <DetailItem label="Created By" value={order.createdBy?.name} />
          </DetailSection>

          <DetailSection title={order.orderType === "DISTRIBUTOR" ? "Distributor" : order.orderType === "MARKETPLACE" ? "Buyer" : "Customer"}>
            <DetailItem
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
            <DetailItem label="Phone" value={order.customerPhone} />
            <DetailItem label="Address" value={order.customerAddress} />
          </DetailSection>

          <section className="space-y-3">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">
              Items ({order.items.length} lines · {formatNumber(qty)} units)
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-head text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right hidden sm:table-cell">Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((i, idx) => (
                    <tr key={`${i.product}-${idx}`}>
                      <td className="px-3 py-2">
                        <span className="block font-semibold text-slate-800">{i.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {i.sku}
                          <span className="sm:hidden"> · {formatCurrency(i.price)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{formatNumber(i.quantity)}</td>
                      <td className="px-3 py-2 text-right hidden sm:table-cell">{formatCurrency(i.price)}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto w-full sm:w-80 text-xs divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              <Total label="Subtotal" value={formatCurrency(order.subtotal)} />
              {order.discount > 0 && <Total label="Discount" value={`− ${formatCurrency(order.discount)}`} />}
              {order.tax > 0 && <Total label={`Tax (${order.taxPercent}%)`} value={formatCurrency(order.tax)} />}
              <Total label="Total" value={formatCurrency(order.total)} strong />
              <Total label="Paid" value={formatCurrency(order.paid)} />
              {order.status !== "DRAFT" && order.status !== "CANCELLED" && order.status !== "RETURNED" && (
                <Total label="Outstanding" value={<span className={order.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}>{formatCurrency(order.outstanding)}</span>} />
              )}
            </dl>
          </section>

          {order.notes && (
            <DetailSection title="Notes">
              <DetailItem label="Notes" value={order.notes} />
            </DetailSection>
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
        <ol className="p-4 space-y-3">
          {[...order.history].reverse().map((h, idx) => (
            <li key={idx} className="flex gap-3 text-xs">
              <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${idx === 0 ? "bg-brand" : "bg-slate-300"}`} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">
                  {ORDER_STATUS_LABELS[h.status]}
                  <span className="font-normal text-slate-500">
                    {" "}
                    · {formatDateTime(h.at)}
                    {h.by ? ` · ${h.by}` : ""}
                  </span>
                </p>
                {h.note && <p className="text-[11px] text-slate-500">{h.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${strong ? "bg-brand-light/60" : ""}`}>
      <dt className={strong ? "font-bold text-slate-900" : "text-slate-600"}>{label}</dt>
      <dd className={strong ? "font-black text-brand text-sm" : "font-semibold text-slate-800"}>{value}</dd>
    </div>
  );
}
