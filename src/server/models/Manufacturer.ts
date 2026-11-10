import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

/** Manufacturing unit and its batch-code prefixes (see lib/batchCodeTypes). */
export interface ManufacturerDoc {
  _id: Types.ObjectId;
  name: string;
  address: string;
  fssaiLicNo: string;
  batchCodes: string[];
  phone?: string;
  notes?: string;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ManufacturerSchema = new Schema<ManufacturerDoc>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    fssaiLicNo: { type: String, required: true, trim: true },
    batchCodes: { type: [{ type: String, uppercase: true, trim: true }], default: [] },
    phone: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// A batch code belongs to exactly one manufacturer (unique across all documents)
ManufacturerSchema.index({ batchCodes: 1 }, { unique: true });
ManufacturerSchema.index({ name: 1 });

export const Manufacturer: Model<ManufacturerDoc> =
  (models.Manufacturer as Model<ManufacturerDoc>) || model<ManufacturerDoc>("Manufacturer", ManufacturerSchema);
