import { model, models, Schema, type Model, type Types } from "mongoose";

/** Central stock: one row per product, shared by every order type. Never negative. */
export interface InventoryDoc {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  quantity: number;
  lastMovementAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<InventoryDoc>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    quantity: { type: Number, default: 0, min: 0 },
    lastMovementAt: { type: Date },
  },
  { timestamps: true }
);

InventorySchema.index({ quantity: 1 });

export const Inventory: Model<InventoryDoc> =
  (models.Inventory as Model<InventoryDoc>) || model<InventoryDoc>("Inventory", InventorySchema);
