/**
 * Products, inventory, channels, customers and orders. Money is in rupees here
 * (the server stores integer paise and converts at the service boundary).
 */
import type { AttachedDocument } from "./documents";
import type { NamedRef, RecordStatus } from "./types";

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  _id: string;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  description?: string;
  /** Maximum retail price (0 = not set) */
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  /** Low-stock alert when available stock is at or below this */
  reorderLevel: number;
  status: RecordStatus;
  /** Central stock on hand (joined from Inventory); for a product with variants, the variants' total */
  stock?: number;
  /** Photos, first = cover (a variant has at most one) */
  images?: ProductImage[];
  /** Set on a variant: its parent product */
  parent?: string | null;
  /** Variant label, e.g. "500 g" or "Red / XL" (name = parent name - variant name) */
  variantName?: string;
  /** True on a product whose stock and sales are kept on its variants */
  hasVariants?: boolean;
  /** Delivered free of charge */
  freeDelivery?: boolean;
  /** Storefront chips filter, e.g. Traditional */
  flavorProfile?: string;
  summary?: string;
  story?: string;
  ingredients?: string;
  shelfLife?: string;
  /** "YYYY-MM-DD" */
  mfgDate?: string;
  expiryDate?: string;
  storefrontVisible?: boolean;
  /** Storefront position (1 = first; 0 = not set) */
  displayOrder?: number;
  instagramReels?: string[];
  /** Variant packet weight / size and unit */
  size?: string;
  unit?: string;
  /** Variants of this product (list and detail pages) */
  variants?: Product[];
  /** Variant detail page: the parent's name */
  parentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductImage = Pick<AttachedDocument, "url" | "publicId" | "resourceType" | "name" | "size">;

/** Storefront discount (Products → Offers). */
export interface Offer {
  _id: string;
  name: string;
  description?: string;
  discountType: "percent" | "flat";
  value: number;
  appliesTo: "all" | "categories" | "products";
  categories: string[];
  /** Product ids */
  products: string[];
  /** Names of `products`, for the list */
  productNames?: string[];
  startDate?: string;
  endDate?: string;
  status: RecordStatus;
  /** live / scheduled / expired / inactive, worked out for today (India) */
  state?: "live" | "scheduled" | "expired" | "inactive";
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  status: RecordStatus;
  /** Optional photo */
  image?: ProductImage | null;
  /** Products (not counting variants) in this category */
  productCount?: number;
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
  /** Most this marketplace may sell; null = no limit */
  allocatedQty: number | null;
  /** Units sold here (confirmed / shipped / delivered / completed orders) */
  soldQty: number;
  /** Assigned − sold; null = no limit */
  remainingQty: number | null;
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

export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"] as const;
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
  /** Optional shipping charge (added after tax) */
  shipping: number;
  total: number;
  paid: number;
  outstanding: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  courier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  notes?: string;
  history: OrderStatusEvent[];
  createdBy?: { _id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Orders in these statuses count as sales (stock deducted, income booked). */
export const SALE_STATUSES: OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED"];

/**
 * Statuses the status dropdown offers from the current one. Moves are free between Pending and the sale
 * statuses; the server applies the stock / income side effects (Pending → sale deducts stock; sale →
 * Pending / Cancelled / Returned puts it back). A cancelled order can only be re-opened as Pending;
 * Returned is final.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"],
  CONFIRMED: ["PENDING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"],
  SHIPPED: ["PENDING", "CONFIRMED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"],
  DELIVERED: ["PENDING", "CONFIRMED", "SHIPPED", "COMPLETED", "CANCELLED", "RETURNED"],
  COMPLETED: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"],
  CANCELLED: ["PENDING"],
  RETURNED: [],
};
