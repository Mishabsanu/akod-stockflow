import { model, models, Schema, type Model } from "mongoose";

/** Company details (one document, _id "company"). Printed on orders. */
export interface SettingDoc {
  _id: string;
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  /** Reorder level given to new products */
  defaultReorderLevel: number;
  updatedAt: Date;
  createdAt: Date;
}

const SettingSchema = new Schema<SettingDoc>(
  {
    _id: { type: String, required: true },
    companyName: { type: String, trim: true, default: "AKOD Group" },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    defaultReorderLevel: { type: Number, default: 10, min: 0 },
  },
  { timestamps: true }
);

export const Setting: Model<SettingDoc> = (models.Setting as Model<SettingDoc>) || model<SettingDoc>("Setting", SettingSchema);
