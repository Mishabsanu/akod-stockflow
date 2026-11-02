import { model, models, Schema, type Model, type Types } from "mongoose";
import { STOCK_TXN_TYPES, type StockTxnType } from "@/lib/commerceTypes";

export interface StockTransactionDoc {
  _id: Types.ObjectId;
  txnNo: string;
  type: StockTxnType;
  product: Types.ObjectId;
  sku: string;
  /** Signed: + adds stock, − removes it */
  change: number;
  before: number;
  after: number;
  poNumber?: string;
  /** Order number for order movements */
  reference?: string;
  order?: Types.ObjectId | null;
  /** Business date "YYYY-MM-DD" */
  txnDate: string;
  reason?: string;
  source: "manual" | "csv" | "order";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockTransactionSchema = new Schema<StockTransactionDoc>(
  {
    txnNo: { type: String, required: true, unique: true },
    type: { type: String, enum: STOCK_TXN_TYPES, required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true, index: true },
    change: { type: Number, required: true },
    before: { type: Number, required: true },
    after: { type: Number, required: true },
    poNumber: { type: String, trim: true, default: "", index: true },
    reference: { type: String, trim: true, default: "" },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    txnDate: { type: String, required: true, index: true },
    reason: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["manual", "csv", "order"], default: "manual" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

StockTransactionSchema.index({ createdAt: -1 });

export const StockTransaction: Model<StockTransactionDoc> =
  (models.StockTransaction as Model<StockTransactionDoc>) ||
  model<StockTransactionDoc>("StockTransaction", StockTransactionSchema);
