import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

export interface ProductDoc {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  description?: string;
  sellingPricePaise: number;
  costPricePaise: number;
  /** Low-stock alert at or below this quantity */
  reorderLevel: number;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    sellingPricePaise: { type: Number, default: 0, min: 0 },
    costPricePaise: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Barcode is optional but must be unique when given
ProductSchema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $gt: "" } } });
ProductSchema.index({ name: 1 });

export const Product: Model<ProductDoc> = (models.Product as Model<ProductDoc>) || model<ProductDoc>("Product", ProductSchema);
