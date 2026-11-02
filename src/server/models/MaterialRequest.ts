import { model, models, Schema, type Model, type Types } from "mongoose";
import { MR_PRIORITIES, MR_STATUSES, type MrPriority, type MrStatus } from "@/lib/materialRequestTypes";

export interface MrItemDoc {
  product: Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  receivedQty: number;
}

export interface MrEventDoc {
  status: MrStatus;
  at: Date;
  by?: string;
  note?: string;
}

export interface MaterialRequestDoc {
  _id: Types.ObjectId;
  mrNo: string;
  requestDate: string;
  requiredBy?: string;
  priority: MrPriority;
  /** Always the signed-in user who raised it */
  requestedBy: Types.ObjectId;
  requestedByName: string;
  items: MrItemDoc[];
  notes?: string;
  status: MrStatus;
  rejectReason?: string;
  approvedBy?: Types.ObjectId | null;
  approvedByName?: string;
  approvedAt?: Date | null;
  history: MrEventDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<MrItemDoc>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    receivedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const EventSchema = new Schema<MrEventDoc>(
  {
    status: { type: String, enum: MR_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const MaterialRequestSchema = new Schema<MaterialRequestDoc>(
  {
    mrNo: { type: String, required: true, unique: true },
    requestDate: { type: String, required: true, index: true },
    requiredBy: { type: String, default: "" },
    priority: { type: String, enum: MR_PRIORITIES, default: "MEDIUM", index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedByName: { type: String, required: true, trim: true },
    items: { type: [ItemSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
    status: { type: String, enum: MR_STATUSES, default: "PENDING", index: true },
    rejectReason: { type: String, trim: true, default: "" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedByName: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    history: { type: [EventSchema], default: [] },
  },
  { timestamps: true }
);

MaterialRequestSchema.index({ createdAt: -1 });
MaterialRequestSchema.index({ "items.product": 1 });

export const MaterialRequest: Model<MaterialRequestDoc> =
  (models.MaterialRequest as Model<MaterialRequestDoc>) || model<MaterialRequestDoc>("MaterialRequest", MaterialRequestSchema);
