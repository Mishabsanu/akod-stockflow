import { SALE_STATUSES, type OrderStatus, type OrderType, type PaymentStatus } from "@/lib/commerceTypes";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/financeTypes";
import type { Option } from "@/lib/types";

export const ORDER_UI = {
  label: "Order",
  basePath: "/dashboard/orders",
  apiBase: "/api/orders",
} as const;

/** List page per order type ("all" = every order). */
export const ORDER_LIST_PAGES: Record<"all" | OrderType, { title: string; description: string; href: string }> = {
  all: { title: "All Orders", description: "Marketplace, local and distributor orders in one place", href: "/dashboard/orders" },
  MARKETPLACE: { title: "Marketplace Orders", description: "Orders from Amazon, Flipkart and your other marketplaces", href: "/dashboard/orders/marketplace" },
  LOCAL: { title: "Local Orders", description: "Walk-in and local customer orders", href: "/dashboard/orders/local" },
  DISTRIBUTOR: { title: "Distributor Orders", description: "Distributor orders, credit sales and their balances", href: "/dashboard/orders/distributor" },
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export const ORDER_STATUS_OPTIONS: Option[] = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => ({
  value: s,
  label: ORDER_STATUS_LABELS[s],
}));

export const PAYMENT_STATUS_OPTIONS: Option[] = (["UNPAID", "PARTIAL", "PAID", "REFUND_DUE"] as PaymentStatus[]).map((s) => ({
  value: s,
  label: { UNPAID: "Unpaid", PARTIAL: "Partially Paid", PAID: "Paid", REFUND_DUE: "Refund Due" }[s],
}));

export const PAYMENT_METHOD_OPTIONS: Option[] = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));

export const TAX_PRESETS = [0, 5, 12, 18];

/** What a status change does, shown in the confirm dialog. */
export function statusChangeEffect(from: OrderStatus, to: OrderStatus): { text: string; tone: "primary" | "danger" } {
  const isSale = (s: OrderStatus) => (SALE_STATUSES as OrderStatus[]).includes(s);
  if (to === "CANCELLED") {
    return {
      text: isSale(from)
        ? "Stock from this order goes back to inventory and the income is reversed. Record a refund afterwards if money was received."
        : "The order is cancelled. No stock was deducted yet.",
      tone: "danger",
    };
  }
  if (to === "RETURNED") {
    return { text: "Returned items go back to inventory and the income is reversed. Record a refund afterwards if money was received.", tone: "danger" };
  }
  if (to === "PENDING") {
    return {
      text: isSale(from)
        ? "Stock goes back to inventory and the income is reversed. The order becomes editable again."
        : "The order is re-opened as Pending. Nothing is deducted until it is confirmed.",
      tone: "danger",
    };
  }
  if (!isSale(from)) return { text: "Stock is checked and deducted now, and the sale is booked in income.", tone: "primary" };
  if (to === "SHIPPED") return { text: "Add the courier and tracking number if you have them.", tone: "primary" };
  if (to === "DELIVERED") return { text: "The order is marked as delivered to the customer.", tone: "primary" };
  if (to === "COMPLETED") return { text: "The order is marked as completed.", tone: "primary" };
  return { text: "The order status is updated. Stock and income are not affected.", tone: "primary" };
}
