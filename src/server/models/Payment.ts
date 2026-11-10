import { model, models, Schema, type Model, type Types } from "mongoose";
import { softDeletePlugin } from "./softDelete";
import { PAYMENT_METHODS, type PaymentDirection, type PaymentMethod, type PaymentRefType } from "@/lib/financeTypes";

/**
 * Every rupee in or out (Proserve pattern). RECEIVED settles an order (or other income);
 * MADE settles an expense or refunds an order. Each payment lands in a Cash / Bank account,
 * so the ledger is simply the payments of one account in date order.
 */
export interface PaymentDoc {
  _id: Types.ObjectId;
  paymentNo: string;
  paymentDate: string;
  direction: PaymentDirection;
  referenceType: PaymentRefType;
  referenceId?: Types.ObjectId | null;
  referenceLabel?: string;
  partyName?: string;
  amountPaise: number;
  method: PaymentMethod;
  account?: Types.ObjectId | null;
  transactionRef?: string;
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>(
  {
    paymentNo: { type: String, required: true, unique: true },
    paymentDate: { type: String, required: true, index: true },
    direction: { type: String, enum: ["RECEIVED", "MADE"], required: true, index: true },
    referenceType: { type: String, enum: ["ORDER", "EXPENSE", "INCOME", "GENERAL"], required: true },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    referenceLabel: { type: String, trim: true, default: "" },
    partyName: { type: String, trim: true, default: "" },
    amountPaise: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    account: { type: Schema.Types.ObjectId, ref: "Account", default: null, index: true },
    transactionRef: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PaymentSchema.index({ referenceType: 1, referenceId: 1 });

// Deleting moves the record to the Recycle Bin (see softDelete.ts)
PaymentSchema.plugin(softDeletePlugin, {});

export const Payment: Model<PaymentDoc> = (models.Payment as Model<PaymentDoc>) || model<PaymentDoc>("Payment", PaymentSchema);
