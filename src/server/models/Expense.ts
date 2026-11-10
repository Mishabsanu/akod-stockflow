import { model, models, Schema, type Model, type Types } from "mongoose";
import { softDeletePlugin } from "./softDelete";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type ExpenseCategory, type ExpenseStatus, type PaymentMethod } from "@/lib/financeTypes";

/** Business expense. paid / balance / status are recalculated from linked "MADE" payments (settlement.ts). */
export interface ExpenseDoc {
  _id: Types.ObjectId;
  expenseNo: string;
  expenseDate: string;
  dueDate?: string;
  category: ExpenseCategory;
  /** Free text — there is deliberately no vendor master */
  payeeName?: string;
  /** Marketplace fees can be tied to the marketplace */
  channel?: Types.ObjectId | null;
  description?: string;
  amountPaise: number;
  paidPaise: number;
  balancePaise: number;
  status: ExpenseStatus;
  paymentMethod?: PaymentMethod | "";
  referenceNo?: string;
  cancelledAt?: Date | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    expenseNo: { type: String, required: true, unique: true },
    expenseDate: { type: String, required: true, index: true },
    dueDate: { type: String, default: "" },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    payeeName: { type: String, trim: true, default: "" },
    channel: { type: Schema.Types.ObjectId, ref: "Channel", default: null, index: true },
    description: { type: String, trim: true, default: "" },
    amountPaise: { type: Number, required: true, min: 1 },
    paidPaise: { type: Number, default: 0, min: 0 },
    balancePaise: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["PENDING", "PARTIAL", "PAID", "CANCELLED"], default: "PENDING", index: true },
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, ""], default: "" },
    referenceNo: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Deleting moves the record to the Recycle Bin (see softDelete.ts)
ExpenseSchema.plugin(softDeletePlugin, {});

export const Expense: Model<ExpenseDoc> = (models.Expense as Model<ExpenseDoc>) || model<ExpenseDoc>("Expense", ExpenseSchema);
