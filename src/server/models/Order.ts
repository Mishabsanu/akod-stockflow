import { model, models, Schema, type Model, type Types } from "mongoose";
import { ORDER_STATUSES, ORDER_TYPES, PAYMENT_STATUSES, type OrderStatus, type OrderType, type PaymentStatus } from "@/lib/commerceTypes";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/financeTypes";

/** Order line (embedded: an order and its items are always written together). */
export interface OrderItemDoc {
  product: Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  pricePaise: number;
  totalPaise: number;
}

export interface OrderStatusEventDoc {
  status: OrderStatus;
  at: Date;
  by?: string;
  note?: string;
}

export interface OrderDoc {
  _id: Types.ObjectId;
  orderNo: string;
  orderType: OrderType;
  channel?: Types.ObjectId | null;
  orderReference?: string;
  customer?: Types.ObjectId | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  /** "YYYY-MM-DD" */
  orderDate: string;
  dueDate?: string;
  items: OrderItemDoc[];
  subtotalPaise: number;
  discountPaise: number;
  taxPercent: number;
  taxPaise: number;
  totalPaise: number;
  /** Received − refunded, kept in step with Payments by settlement.ts */
  paidPaise: number;
  outstandingPaise: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  /** Payment taken with the order; posted as a Payment when the order is confirmed */
  upfrontPaymentPaise: number;
  upfrontPaymentMethod?: PaymentMethod | "";
  upfrontPaymentRef?: string;
  courier?: string;
  trackingNumber?: string;
  shippedAt?: Date | null;
  notes?: string;
  history: OrderStatusEventDoc[];
  confirmedAt?: Date | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItemDoc>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    pricePaise: { type: Number, required: true, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const HistorySchema = new Schema<OrderStatusEventDoc>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const OrderSchema = new Schema<OrderDoc>(
  {
    orderNo: { type: String, required: true, unique: true },
    orderType: { type: String, enum: ORDER_TYPES, required: true, index: true },
    channel: { type: Schema.Types.ObjectId, ref: "Channel", default: null, index: true },
    orderReference: { type: String, trim: true, default: "" },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    customerAddress: { type: String, trim: true, default: "" },
    orderDate: { type: String, required: true, index: true },
    dueDate: { type: String, default: "" },
    items: { type: [OrderItemSchema], default: [] },
    subtotalPaise: { type: Number, default: 0, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    taxPaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, default: 0, min: 0 },
    paidPaise: { type: Number, default: 0 },
    outstandingPaise: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "UNPAID", index: true },
    status: { type: String, enum: ORDER_STATUSES, default: "DRAFT", index: true },
    upfrontPaymentPaise: { type: Number, default: 0, min: 0 },
    upfrontPaymentMethod: { type: String, enum: [...PAYMENT_METHODS, ""], default: "" },
    upfrontPaymentRef: { type: String, trim: true, default: "" },
    courier: { type: String, trim: true, default: "" },
    trackingNumber: { type: String, trim: true, default: "" },
    shippedAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    history: { type: [HistorySchema], default: [] },
    confirmedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ "items.product": 1 });
OrderSchema.index({ orderReference: 1 });

export const Order: Model<OrderDoc> = (models.Order as Model<OrderDoc>) || model<OrderDoc>("Order", OrderSchema);
