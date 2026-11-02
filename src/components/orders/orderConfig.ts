import type { OrderStatus, OrderType, PaymentStatus } from "@/lib/commerceTypes";
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
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
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

/** Action button text for each target status. */
export const STATUS_ACTIONS: Record<OrderStatus, { label: string; confirm: string; variant: "primary" | "outline" | "danger" }> = {
  DRAFT: { label: "Draft", confirm: "", variant: "outline" },
  CONFIRMED: {
    label: "Confirm Order",
    confirm: "Stock will be checked and deducted, and the sale is booked in income.",
    variant: "primary",
  },
  PROCESSING: { label: "Mark Processing", confirm: "Mark this order as being packed / shipped.", variant: "outline" },
  COMPLETED: { label: "Complete", confirm: "Mark this order as delivered and completed.", variant: "primary" },
  CANCELLED: {
    label: "Cancel Order",
    confirm: "Stock from this order goes back to inventory and the income is reversed (if it was confirmed).",
    variant: "danger",
  },
  RETURNED: {
    label: "Mark Returned",
    confirm: "Returned items go back to inventory and the income is reversed. Record a refund afterwards if money was received.",
    variant: "danger",
  },
};
