import "server-only";
import { ORDER_TYPE_LABELS, PAYMENT_STATUS_LABELS, type Customer, type Order } from "@/lib/commerceTypes";
import { exportCustomers } from "../services/customer.service";
import { exportOrders } from "../services/order.service";
import type { IoEntity } from "./types";

/** Orders list export (same filters as the screen). */
export const ordersIo: IoEntity<Order> = {
  title: "Orders",
  module: "order",
  fileName: "Orders",
  columns: [
    { header: "Order No", width: 14, value: (o) => o.orderNo },
    { header: "Order Date", width: 12, value: (o) => o.orderDate },
    { header: "Order Type", width: 13, value: (o) => ORDER_TYPE_LABELS[o.orderType] },
    { header: "Marketplace", width: 16, value: (o) => o.channel?.name ?? "" },
    { header: "Order Reference", width: 20, value: (o) => o.orderReference ?? "" },
    { header: "Customer / Distributor", width: 26, value: (o) => o.customerName ?? "" },
    { header: "Phone", width: 16, value: (o) => o.customerPhone ?? "" },
    { header: "Items", width: 8, value: (o) => o.items.length },
    { header: "Quantity", width: 10, value: (o) => o.items.reduce((s, i) => s + i.quantity, 0) },
    { header: "Subtotal", width: 12, value: (o) => o.subtotal },
    { header: "Discount", width: 11, value: (o) => o.discount },
    { header: "Tax", width: 10, value: (o) => o.tax },
    { header: "Total", width: 12, value: (o) => o.total },
    { header: "Paid", width: 12, value: (o) => o.paid },
    { header: "Outstanding", width: 13, value: (o) => o.outstanding },
    { header: "Payment Status", width: 15, value: (o) => PAYMENT_STATUS_LABELS[o.paymentStatus] },
    { header: "Status", width: 12, value: (o) => o.status },
    { header: "Due Date", width: 12, value: (o) => o.dueDate ?? "" },
    { header: "Courier", width: 14, value: (o) => o.courier ?? "" },
    { header: "Tracking Number", width: 20, value: (o) => o.trackingNumber ?? "" },
  ],
  rows: exportOrders,
};

/** Customers & distributors export. */
export const customersIo: IoEntity<Customer> = {
  title: "Customers & Distributors",
  module: "customer",
  fileName: "Customers",
  columns: [
    { header: "Code", width: 11, value: (c) => c.code },
    { header: "Type", width: 12, value: (c) => (c.kind === "distributor" ? "Distributor" : "Local") },
    { header: "Name", width: 28, value: (c) => c.name },
    { header: "Contact Person", width: 20, value: (c) => c.contactPerson ?? "" },
    { header: "Phone", width: 16, value: (c) => c.phone ?? "" },
    { header: "Email", width: 24, value: (c) => c.email ?? "" },
    { header: "GSTIN", width: 18, value: (c) => c.gstin ?? "" },
    { header: "Address", width: 34, value: (c) => c.address ?? "" },
    { header: "Credit Days", width: 11, value: (c) => c.creditDays },
    { header: "Outstanding", width: 13, value: (c) => c.outstanding ?? 0 },
    { header: "Status", width: 10, value: (c) => c.status },
  ],
  rows: exportCustomers,
};
