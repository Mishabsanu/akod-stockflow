import { model, models, Schema, type Model, type Types } from "mongoose";
import { softDeletePlugin } from "./softDelete";
import type { RecordStatus } from "@/lib/types";

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: Types.ObjectId;
  status: RecordStatus;
  lastLoginAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    // Never returned unless explicitly selected
    password: { type: String, required: true, select: false },
    role: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    lastLoginAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

UserSchema.index({ createdAt: -1 });

// Deleting moves the record to the Recycle Bin (see softDelete.ts)
UserSchema.plugin(softDeletePlugin, { unique: ["email"] });

export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);
