"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig } from "@/components/table/types";
import { ORDER_TYPE_LABELS, ORDER_TYPES, type Order, type OrderType } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import type { Option, Paginated } from "@/lib/types";
import { OrderStatusBadge, OrderTypeBadge, PaymentStatusBadge } from "./OrderBadges";
import { ORDER_STATUS_OPTIONS, ORDER_UI, PAYMENT_STATUS_OPTIONS } from "./orderConfig";

interface OrderListViewProps {
  data: Paginated<Order>;
  channels: Option[];
  /** Set on the type-specific pages: that filter is fixed and its column hidden */
  fixedType?: OrderType;
}

export function OrderListView({ data, channels, fixedType }: OrderListViewProps) {
  const canEdit = usePermission("order", "update");
  const canDelete = usePermission("order", "delete");

  const columns = useMemo<Column<Order>[]>(() => {
    const cols: (Column<Order> | false)[] = [
      {
        key: "orderNo",
        label: "Order",
        render: (o) => (
          <Link href={`${ORDER_UI.basePath}/${o._id}`} className="inline-flex flex-col hover:underline">
            <span className="font-mono font-bold text-brand">{o.orderNo}</span>
            <span className="text-[11px] text-slate-500">{formatDay(o.orderDate)}</span>
          </Link>
        ),
      },
      !fixedType && { key: "orderType", label: "Type", render: (o) => <OrderTypeBadge type={o.orderType} /> },
      fixedType !== "LOCAL" &&
        fixedType !== "DISTRIBUTOR" && {
          key: "channel",
          label: "Marketplace",
          render: (o) => o.channel?.name ?? <span className="text-slate-400">—</span>,
        },
      { key: "orderReference", label: "Reference", mono: true, render: (o) => o.orderReference || "—" },
      {
        key: "customerName",
        label: fixedType === "DISTRIBUTOR" ? "Distributor" : "Customer",
        render: (o) => (
          <span className="inline-flex flex-col">
            <span className="font-semibold text-slate-800">{o.customerName || "—"}</span>
            {o.customerPhone && <span className="text-[11px] text-slate-500">{o.customerPhone}</span>}
          </span>
        ),
      },
      {
        key: "items",
        label: "Qty",
        align: "right",
        render: (o) => formatNumber(o.items.reduce((s, i) => s + i.quantity, 0)),
      },
      { key: "total", label: "Total", align: "right", render: (o) => <span className="font-semibold">{formatCurrency(o.total)}</span> },
      { key: "paid", label: "Paid", align: "right", hiddenByDefault: true, render: (o) => formatCurrency(o.paid) },
      {
        key: "outstanding",
        label: "Outstanding",
        align: "right",
        render: (o) =>
          o.outstanding > 0 && o.status !== "PENDING" ? (
            <span className="font-semibold text-rose-700">{formatCurrency(o.outstanding)}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        key: "paymentStatus",
        label: "Payment",
        align: "center",
        render: (o) => <PaymentStatusBadge status={o.paymentStatus} orderStatus={o.status} />,
      },
      { key: "status", label: "Status", align: "center", render: (o) => <OrderStatusBadge status={o.status} /> },
      {
        key: "trackingNumber",
        label: "Tracking",
        render: (o) =>
          o.trackingNumber ? (
            <span className="inline-flex flex-col">
              <span className="font-mono text-[11px] font-semibold">{o.trackingNumber}</span>
              {o.courier && <span className="text-[10.5px] text-slate-500">{o.courier}</span>}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      { key: "dueDate", label: "Due", hiddenByDefault: true, render: (o) => (o.dueDate ? formatDay(o.dueDate) : "—") },
    ];
    return cols.filter(Boolean) as Column<Order>[];
  }, [fixedType]);

  const filters = useMemo<FilterConfig[]>(() => {
    const list: FilterConfig[] = [];
    if (!fixedType) {
      list.push({
        key: "orderType",
        allLabel: "All Types",
        options: ORDER_TYPES.map((t) => ({ value: t, label: ORDER_TYPE_LABELS[t] })),
      });
    }
    if (!fixedType || fixedType === "MARKETPLACE") {
      list.push({ key: "channel", allLabel: "All Marketplaces", minWidth: "160px", options: channels });
    }
    list.push(
      { key: "status", allLabel: "All Status", options: ORDER_STATUS_OPTIONS },
      { key: "paymentStatus", allLabel: "All Payments", minWidth: "150px", options: PAYMENT_STATUS_OPTIONS }
    );
    return list;
  }, [channels, fixedType]);

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="orders"
      searchPlaceholder="Search order no, reference, customer, phone, tracking..."
      filters={filters}
      rowActions={(o) => (
        <RowActions
          entityLabel={ORDER_UI.label}
          itemName={o.orderNo}
          viewHref={`${ORDER_UI.basePath}/${o._id}`}
          editHref={canEdit && o.status === "PENDING" ? `${ORDER_UI.basePath}/${o._id}/edit` : undefined}
          deleteUrl={canDelete && o.status === "PENDING" ? `${ORDER_UI.apiBase}/${o._id}` : undefined}
        />
      )}
    />
  );
}
