import { model, models, Schema, type Model, type Types } from "mongoose";

/** A product listed on a marketplace. Marketplace orders can only use these products. */
export interface ChannelProductDoc {
  _id: Types.ObjectId;
  channel: Types.ObjectId;
  product: Types.ObjectId;
  /** Marketplace listing id (ASIN, FSN …), optional */
  channelSku?: string;
  /** 0 = use the product selling price */
  channelPricePaise: number;
  /** Most this marketplace may sell (null = no limit). Sold is derived from its orders. */
  allocatedQty?: number | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelProductSchema = new Schema<ChannelProductDoc>(
  {
    channel: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    channelSku: { type: String, trim: true, default: "" },
    channelPricePaise: { type: Number, default: 0, min: 0 },
    allocatedQty: { type: Number, default: null, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ChannelProductSchema.index({ channel: 1, product: 1 }, { unique: true });

export const ChannelProduct: Model<ChannelProductDoc> =
  (models.ChannelProduct as Model<ChannelProductDoc>) || model<ChannelProductDoc>("ChannelProduct", ChannelProductSchema);
