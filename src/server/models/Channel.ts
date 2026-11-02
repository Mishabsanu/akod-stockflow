import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

/** A marketplace the business sells on (Amazon, Flipkart, Blinkit …), created by the user. */
export interface ChannelDoc {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<ChannelDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Channel: Model<ChannelDoc> = (models.Channel as Model<ChannelDoc>) || model<ChannelDoc>("Channel", ChannelSchema);
