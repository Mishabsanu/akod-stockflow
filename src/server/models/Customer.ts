import { model, models, Schema, type Model, type Types } from "mongoose";
import { softDeletePlugin } from "./softDelete";
import type { CustomerKind } from "@/lib/commerceTypes";
import type { RecordStatus } from "@/lib/types";

/** Lightweight contact for local customers and distributors (no full CRM). */
export interface CustomerDoc {
  _id: Types.ObjectId;
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
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<CustomerDoc>(
  {
    code: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["local", "distributor"], required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    creditDays: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 1 });

// Deleting moves the record to the Recycle Bin (see softDelete.ts)
CustomerSchema.plugin(softDeletePlugin, {});

export const Customer: Model<CustomerDoc> =
  (models.Customer as Model<CustomerDoc>) || model<CustomerDoc>("Customer", CustomerSchema);
