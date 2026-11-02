/**
 * Products, inventory, channels, customers and orders. Money is in rupees here
 * (the server stores integer paise and converts at the service boundary).
 */
import type { NamedRef, RecordStatus } from "./types";

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  _id: string;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  description?: string;
  sellingPrice: number;
  costPrice: number;
  /** Low-stock alert when available stock is at or below this */
  reorderLevel: number;
  status: RecordStatus;
  /** Central stock on hand (joined from Inventory) */
  stock?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export const STOCK_TXN_TYPES = [
  "STOCK_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "ORDER_OUT",
  "ORDER_CANCEL",
  "ORDER_RETURN",
] as const;
export type StockTxnType = (typeof STOCK_TXN_TYPES)[number];

export const STOCK_TXN_LABELS: Record<StockTxnType, string> = {
  STOCK_IN: "Stock In",
  ADJUSTMENT_IN: "Adjustment (+)",
  ADJUSTMENT_OUT: "Adjustment (−)",
  ORDER_OUT: "Order Confirmed",
  ORDER_CANCEL: "Order Cancelled",
  ORDER_RETURN: "Order Returned",
};

export type StockLevel = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface InventoryRow {
  _id: string;
  product: NamedRef & { sku: string; category?: string; status: RecordStatus; reorderLevel: number; costPrice: number; sellingPrice: number };
  quantity: number;
  level: StockLevel;
  /** quantity × cost price */
  stockValue: number;
  lastMovementAt?: string;
}

export interface StockTransaction {
  _id: string;
  txnNo: string;
  type: StockTxnType;
  sku: string;
  product: NamedRef & { sku: string };
  /** Signed change: + adds stock, − removes it */
  change: number;
  before: number;
  after: number;
  poNumber?: string;
  /** Order number for order movements */
  reference?: string;
  order?: string | null;
  txnDate: string;
  reason?: string;
  source: "manual" | "csv" | "order";
  createdBy?: { _id: string; name: string } | null;
  createdAt?: string;
}

// ─── Channels ────────────────────────────────────────────────────────────────

export interface Channel {
  _id: string;
  code: string;
  name: string;
  description?: string;
  status: RecordStatus;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChannelProduct {
  _id: string;
  channel: string;
  product: NamedRef & { sku: string; category?: string; sellingPrice: number; status: RecordStatus };
  /** Marketplace's own listing id (ASIN, FSN …), optional */
  channelSku?: string;
  /** Price on this marketplace; 0 = use the product selling price */
  channelPrice: number;
  stock?: number;
  createdAt?: string;
}

// ─── Customers & distributors ────────────────────────────────────────────────

export type CustomerKind = "local" | "distributor";

export interface Customer {
  _id: string;
  code: string;
  kind: CustomerKind;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  /** Distributors: due date = order date + credit days */
  creditDays: number;
  status: RecordStatus;
  outstanding?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export const ORDER_TYPES = ["MARKETPLACE", "LOCAL", "DISTRIBUTOR"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  MARKETPLACE: "Marketplace",
  LOCAL: "Local",
  DISTRIBUTOR: "Distributor",
};

export const ORDER_STATUSES = ["DRAFT", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED", "RETURNED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUND_DUE"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
  REFUND_DUE: "Refund Due",
};

export interface OrderItem {
  product: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  by?: string;
  note?: string;
}

export interface Order {
  _id: string;
  orderNo: string;
  orderType: OrderType;
  channel: NamedRef | null;
  orderReference?: string;
  customer: NamedRef | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  orderDate: string;
  dueDate?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  taxPercent: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  courier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  notes?: string;
  history: OrderStatusEvent[];
  createdBy?: { _id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Statuses an order may move to from its current one. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "COMPLETED", "CANCELLED"],
  PROCESSING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Orders in these statuses count as sales (stock deducted, income booked). */
export const SALE_STATUSES: OrderStatus[] = ["CONFIRMED", "PROCESSING", "COMPLETED"];
