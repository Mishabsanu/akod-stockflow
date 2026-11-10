import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

export interface ProductImageDoc {
  url: string;
  publicId: string;
  resourceType: string;
  name: string;
  size: number;
}

/**
 * A product, or a variant of one (`parent` set). Variants are full products with their own SKU,
 * price, stock and Inventory row, so orders, stock, channels and reports treat them like any product.
 * A product with variants (`hasVariants`) only groups them: it is not sold and holds no stock.
 */
export interface ProductDoc {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  description?: string;
  /** Maximum retail price (0 = not set) */
  mrpPaise: number;
  sellingPricePaise: number;
  costPricePaise: number;
  /** Low-stock alert at or below this quantity */
  reorderLevel: number;
  status: RecordStatus;
  /** Photos, first = cover (a variant has at most one) */
  images: ProductImageDoc[];
  parent?: Types.ObjectId | null;
  variantName?: string;
  hasVariants?: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<ProductImageDoc>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, default: "image" },
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema<ProductDoc>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    mrpPaise: { type: Number, default: 0, min: 0 },
    sellingPricePaise: { type: Number, default: 0, min: 0 },
    costPricePaise: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    images: { type: [ImageSchema], default: [] },
    parent: { type: Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    variantName: { type: String, trim: true, default: "" },
    hasVariants: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Barcode is optional but must be unique when given
ProductSchema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $gt: "" } } });
ProductSchema.index({ name: 1 });

export const Product: Model<ProductDoc> = (models.Product as Model<ProductDoc>) || model<ProductDoc>("Product", ProductSchema);
