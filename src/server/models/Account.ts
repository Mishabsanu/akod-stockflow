import { model, models, Schema, type Model, type Types } from "mongoose";
import type { AccountType } from "@/lib/financeTypes";
import type { RecordStatus } from "@/lib/types";

/** Cash / Bank account. Balance = opening + payments received − payments made. */
export interface AccountDoc {
  _id: Types.ObjectId;
  code: string;
  name: string;
  type: AccountType;
  openingBalancePaise: number;
  /** Default account for its type: cash payments go to the default CASH account, others to the default BANK */
  isDefault: boolean;
  description?: string;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<AccountDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["CASH", "BANK"], required: true },
    openingBalancePaise: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export const Account: Model<AccountDoc> = (models.Account as Model<AccountDoc>) || model<AccountDoc>("Account", AccountSchema);
