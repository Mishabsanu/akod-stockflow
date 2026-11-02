import "server-only";
import { assertAllocatable } from "../services/channelAllocation";
import { isValidObjectId } from "mongoose";
import type { Channel, ChannelProduct } from "@/lib/commerceTypes";
import { toPaise } from "@/lib/money";
import { AppError } from "../http/errors";
import { parseListQuery } from "../http/query";
import { Channel as ChannelModel } from "../models/Channel";
import { ChannelProduct as ChannelProductModel } from "../models/ChannelProduct";
import { Product } from "../models/Product";
import { allChannelProducts, CHANNEL_PRODUCT_FILTERS, listChannels } from "../services/channel.service";
import type { IoEntity } from "./types";

export const channelsIo: IoEntity<Channel> = {
  title: "Channels",
  module: "channel",
  fileName: "Channels",
  rows: (params) => listChannels({ ...parseListQuery(params), page: 1, limit: 10000 }).then((r) => r.items),
  columns: [
    { header: "Channel Code", value: (c) => c.code, width: 14 },
    { header: "Channel Name", value: (c) => c.name, width: 24 },
    { header: "Description", value: (c) => c.description || "", width: 36 },
    { header: "Products Assigned", value: (c) => c.productCount ?? 0, width: 16 },
    { header: "Status", value: (c) => c.status, width: 10 },
  ],
};

/**
 * Products on one marketplace (?channel=<id>). Import assigns SKUs to that channel
 * (creates the listing, or updates its marketplace SKU / price / assigned qty; blank cells keep the current value).
 */
export const channelProductsIo: IoEntity<ChannelProduct> = {
  title: "Channel Products",
  module: "channel",
  fileName: "Channel_Products",
  requiredField: "sku",
  rows: async (params) => {
    const channel = params.get("channel") ?? "";
    return allChannelProducts(channel, parseListQuery(params, CHANNEL_PRODUCT_FILTERS));
  },
  columns: [
    { header: "SKU Code", field: "sku", value: (r) => r.product.sku, width: 22, aliases: ["sku", "skucode"] },
    { header: "Product Name", value: (r) => r.product.name, width: 34 },
    { header: "Category", value: (r) => r.product.category || "", width: 16 },
    { header: "Marketplace SKU", field: "channelSku", value: (r) => r.channelSku || "", width: 18, aliases: ["asin", "fsn", "listingid"] },
    { header: "Marketplace Price", field: "channelPrice", value: (r) => r.channelPrice || "", numeric: true, width: 16, aliases: ["channelprice", "price"] },
    { header: "Selling Price", value: (r) => r.product.sellingPrice, width: 14 },
    { header: "Assigned Qty", field: "allocatedQty", value: (r) => r.allocatedQty ?? "", numeric: true, width: 13, aliases: ["assigned", "allocatedqty", "qty"] },
    { header: "Sold", value: (r) => r.soldQty, width: 8 },
    { header: "Remaining", value: (r) => r.remainingQty ?? "", width: 11 },
    { header: "Central Stock", value: (r) => r.stock ?? 0, width: 13, aliases: ["stock"] },
    { header: "Product Status", value: (r) => r.product.status, width: 12 },
  ],
  async importRow(record, user, ctx) {
    const channelId = ctx.params.get("channel") ?? "";
    if (!channelId || !isValidObjectId(channelId) || !(await ChannelModel.exists({ _id: channelId }))) {
      throw new AppError("Open the marketplace and import from its page");
    }
    const sku = String(record.sku ?? "").trim().toUpperCase();
    if (!sku) throw new AppError("SKU Code is required");
    const product = await Product.findOne({ sku }).select("_id sku status").lean();
    if (!product) throw new AppError(`SKU ${sku} not found`);
    if (product.status !== "active") throw new AppError(`${sku} is inactive`);
    const price = record.channelPrice;
    if (price !== undefined && (typeof price !== "number" || price < 0)) throw new AppError("Marketplace Price must be a number");

    const existing = await ChannelProductModel.findOne({ channel: channelId, product: product._id }).select("_id").lean();
    const outcome = existing ? "updated" : "created";
    const set: Record<string, unknown> = {};
    if (record.channelSku !== undefined) set.channelSku = String(record.channelSku).trim().slice(0, 60);
    if (typeof price === "number") set.channelPricePaise = toPaise(price);
    const qty = record.allocatedQty;
    if (qty !== undefined) {
      if (typeof qty !== "number" || qty < 0 || !Number.isInteger(qty)) throw new AppError("Assigned Qty must be a whole number");
      await assertAllocatable(channelId, product, qty);
      set.allocatedQty = qty;
    }
    if (!ctx.dryRun) {
      await ChannelProductModel.updateOne(
        { channel: channelId, product: product._id },
        { $set: set, $setOnInsert: { createdBy: user._id } },
        { upsert: true }
      );
    }
    return { outcome, label: sku, detail: existing ? "Listing updated" : "Will be assigned to the marketplace" };
  },
};
