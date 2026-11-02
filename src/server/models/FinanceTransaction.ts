import { model, models, Schema, type Model, type Types } from "mongoose";
import { INCOME_CATEGORIES, PAYMENT_METHODS, type IncomeCategory, type PaymentMethod } from "@/lib/financeTypes";

/**
 * Income (revenue). Order income is booked automatically when an order is confirmed and reversed
 * if it is cancelled / returned; whether it has been paid is tracked on the order via Payments.
 * Other income is entered by hand and is received immediately (a Payment is posted with it).
 */
export interface FinanceTransactionDoc {
  _id: Types.ObjectId;
  txnNo: string;
  txnDate: string;
  category: IncomeCategory;
  order?: Types.ObjectId | null;
  channel?: Types.ObjectId | null;
  description?: string;
  amountPaise: number;
  paymentMethod?: PaymentMethod | "";
  referenceNo?: string;
  source: "ORDER" | "MANUAL";
  status: "ACTIVE" | "REVERSED";
  reversedAt?: Date | null;
  /** Manual income: the payment that brought the money in */
  payment?: Types.ObjectId | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FinanceTransactionSchema = new Schema<FinanceTransactionDoc>(
  {
    txnNo: { type: String, required: true, unique: true },
    txnDate: { type: String, required: true, index: true },
    category: { type: String, enum: INCOME_CATEGORIES, required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    channel: { type: Schema.Types.ObjectId, ref: "Channel", default: null },
    description: { type: String, trim: true, default: "" },
    amountPaise: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, ""], default: "" },
    referenceNo: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["ORDER", "MANUAL"], required: true },
    status: { type: String, enum: ["ACTIVE", "REVERSED"], default: "ACTIVE", index: true },
    reversedAt: { type: Date, default: null },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const FinanceTransaction: Model<FinanceTransactionDoc> =
  (models.FinanceTransaction as Model<FinanceTransactionDoc>) ||
  model<FinanceTransactionDoc>("FinanceTransaction", FinanceTransactionSchema);
