import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

/** Product category. Products keep the category name (renaming a category renames it on its products). */
export interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  /** Lower-cased name: one category per name regardless of case */
  nameKey: string;
  description?: string;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1 });

export const Category: Model<CategoryDoc> =
  (models.Category as Model<CategoryDoc>) || model<CategoryDoc>("Category", CategorySchema);
