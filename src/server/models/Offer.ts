import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

/** Storefront discount (see lib/validation/offer.schema.ts). */
export interface OfferDoc {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  discountType: "percent" | "flat";
  value: number;
  appliesTo: "all" | "categories" | "products";
  /** Category names (as stored on products) */
  categories: string[];
  /** Top-level products */
  products: Types.ObjectId[];
  /** YYYY-MM-DD, India time; empty = no limit */
  startDate?: string;
  endDate?: string;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<OfferDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    discountType: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 0 },
    appliesTo: { type: String, enum: ["all", "categories", "products"], required: true, default: "all" },
    categories: { type: [String], default: [] },
    products: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Offer: Model<OfferDoc> = (models.Offer as Model<OfferDoc>) || model<OfferDoc>("Offer", OfferSchema);
