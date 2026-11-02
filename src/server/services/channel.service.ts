import "server-only";
import { assertAllocatable, channelSold, remainingOf, sellableOnChannel } from "./channelAllocation";
import { isValidObjectId, Types } from "mongoose";
import type { Channel, ChannelProduct } from "@/lib/commerceTypes";
import { fromPaise, toPaise } from "@/lib/money";
import type { Option, Paginated, RecordStatus } from "@/lib/types";
import type { ChannelInput, ChannelProductInput } from "@/lib/validation/channel.schema";
import { Channel as ChannelModel, type ChannelDoc } from "../models/Channel";
import { ChannelProduct as ChannelProductModel } from "../models/ChannelProduct";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { AppError, notFound } from "../http/errors";
import { escapeRegex, paginate, searchFilter, statusFilter, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";
import type { SellableProduct } from "./product.service";
import { stockFor } from "./stock.service";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

const oid = (id: string) => new Types.ObjectId(id);

async function productCounts(channelIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await ChannelProductModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { channel: { $in: channelIds } } },
    { $group: { _id: "$channel", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listChannels(query: ListQuery): Promise<Paginated<Channel>> {
  const filter: Filter = { ...searchFilter(query.search, ["name", "code", "description"]), ...statusFilter(query.status) };
  const [items, total] = await Promise.all([
    ChannelModel.find(filter)
      .sort(SORTS[query.sort] || SORTS.name)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v -createdBy")
      .lean<ChannelDoc[]>(),
    ChannelModel.countDocuments(filter),
  ]);
  const counts = await productCounts(items.map((c) => c._id));
  return paginate(
    items.map((c) => ({ ...toPlain<Channel>(c), productCount: counts.get(String(c._id)) ?? 0 })),
    total,
    query
  );
}

export async function getChannel(id: string): Promise<Channel> {
  if (!isValidObjectId(id)) throw notFound("Channel");
  const doc = await ChannelModel.findById(id).select("-__v -createdBy").lean<ChannelDoc>();
  if (!doc) throw notFound("Channel");
  const counts = await productCounts([doc._id]);
  return { ...toPlain<Channel>(doc), productCount: counts.get(String(doc._id)) ?? 0 };
}

const clean = (input: ChannelInput) => ({ ...input, code: input.code.trim().toUpperCase() });

export async function createChannel(input: ChannelInput, userId: string): Promise<Channel> {
  const doc = await ChannelModel.create({ ...clean(input), createdBy: userId });
  return getChannel(String(doc._id));
}

export async function updateChannel(id: string, input: ChannelInput): Promise<Channel> {
  if (!isValidObjectId(id)) throw notFound("Channel");
  const doc = await ChannelModel.findByIdAndUpdate(id, clean(input), { returnDocument: "after", runValidators: true }).lean();
  if (!doc) throw notFound("Channel");
  return getChannel(id);
}

export async function setChannelStatus(id: string, status: RecordStatus): Promise<Channel> {
  if (!isValidObjectId(id)) throw notFound("Channel");
  const doc = await ChannelModel.findByIdAndUpdate(id, { status }, { returnDocument: "after" }).lean();
  if (!doc) throw notFound("Channel");
  return getChannel(id);
}

export async function deleteChannel(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Channel");
  if (await Order.exists({ channel: id })) {
    throw new AppError("This marketplace has orders. Deactivate it instead.", 409);
  }
  const deleted = await ChannelModel.findByIdAndDelete(id);
  if (!deleted) throw notFound("Channel");
  await ChannelProductModel.deleteMany({ channel: id });
}

/** Active marketplaces for dropdowns (order form, expense form, filters). */
export async function listChannelOptions(includeInactive = false): Promise<Option[]> {
  const docs = await ChannelModel.find(includeInactive ? {} : { status: "active" }).sort({ name: 1 }).select("name code").lean();
  return docs.map((d) => ({ value: String(d._id), label: d.name }));
}

// ─── Products on a channel ──────────────────────────────────────────────────

export const CHANNEL_PRODUCT_FILTERS = ["category"];

interface CpAgg {
  _id: Types.ObjectId;
  channel: Types.ObjectId;
  channelSku?: string;
  channelPricePaise: number;
  allocatedQty?: number | null;
  createdAt: Date;
  product: { _id: Types.ObjectId; sku: string; name: string; category?: string; sellingPricePaise: number; status: RecordStatus };
}

function cpPipeline(channelId: string, query: ListQuery) {
  const productMatch: Filter = {};
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    productMatch.$or = [{ "product.sku": rx }, { "product.name": rx }, { channelSku: rx }];
  }
  if (query.filters.category) productMatch["product.category"] = query.filters.category;
  if (query.status === "active" || query.status === "inactive") productMatch["product.status"] = query.status;
  return [
    { $match: { channel: oid(channelId) } },
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: productMatch },
  ];
}

/** Only the products assigned to this channel (channel detail page). */
export async function listChannelProducts(channelId: string, query: ListQuery): Promise<Paginated<ChannelProduct>> {
  if (!isValidObjectId(channelId)) throw notFound("Channel");
  const [res] = await ChannelProductModel.aggregate<{ items: CpAgg[]; total: { n: number }[] }>([
    ...cpPipeline(channelId, query),
    {
      $facet: {
        items: [{ $sort: { "product.name": 1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const items = res?.items ?? [];
  const ids = items.map((i) => i.product._id);
  const [stock, sold] = await Promise.all([stockFor(ids), channelSold(channelId, ids)]);
  return paginate(
    items.map((i) => toChannelProduct(i, stock.get(String(i.product._id)) ?? 0, sold.get(String(i.product._id)) ?? 0)),
    res?.total[0]?.n ?? 0,
    query
  );
}

export async function allChannelProducts(channelId: string, query: ListQuery): Promise<ChannelProduct[]> {
  if (!isValidObjectId(channelId)) return [];
  const items = await ChannelProductModel.aggregate<CpAgg>([...cpPipeline(channelId, query), { $sort: { "product.name": 1 } }]);
  const ids = items.map((i) => i.product._id);
  const [stock, sold] = await Promise.all([stockFor(ids), channelSold(channelId, ids)]);
  return items.map((i) => toChannelProduct(i, stock.get(String(i.product._id)) ?? 0, sold.get(String(i.product._id)) ?? 0));
}

function toChannelProduct(i: CpAgg, stock: number, sold: number): ChannelProduct {
  const allocatedQty = i.allocatedQty ?? null;
  return toPlain<ChannelProduct>({
    _id: i._id,
    channel: i.channel,
    channelSku: i.channelSku ?? "",
    channelPrice: fromPaise(i.channelPricePaise),
    allocatedQty,
    soldQty: sold,
    remainingQty: remainingOf(allocatedQty, sold),
    stock,
    createdAt: i.createdAt,
    product: {
      _id: i.product._id,
      sku: i.product.sku,
      name: i.product.name,
      category: i.product.category,
      sellingPrice: fromPaise(i.product.sellingPricePaise),
      status: i.product.status,
    },
  });
}

/**
 * Order form: products assigned to the marketplace that are active, with stock and the
 * price to charge there (channel price, or the product selling price when none is set).
 */
export async function listChannelProductOptions(channelId: string): Promise<SellableProduct[]> {
  if (!isValidObjectId(channelId)) throw notFound("Channel");
  const rows = await ChannelProductModel.aggregate<CpAgg>([
    ...cpPipeline(channelId, { page: 1, limit: 1, search: "", status: "active", sort: "", filters: {} }),
    { $sort: { "product.name": 1 } },
  ]);
  const stock = await stockFor(rows.map((r) => r.product._id));
  const sellable = await sellableOnChannel(
    channelId,
    rows.map((r) => ({ productId: String(r.product._id), stock: stock.get(String(r.product._id)) ?? 0, allocatedQty: r.allocatedQty }))
  );
  return rows.map((r) => ({
    productId: String(r.product._id),
    sku: r.product.sku,
    name: r.product.name,
    price: fromPaise(r.channelPricePaise || r.product.sellingPricePaise),
    // Central stock, capped by what is left of the quantity assigned to this marketplace
    stock: sellable.get(String(r.product._id)) ?? 0,
  }));
}

export interface AssignableProduct {
  _id: string;
  sku: string;
  name: string;
  category?: string;
  sellingPrice: number;
  stock: number;
  assigned: boolean;
}

/** Assign Products modal: active products (searchable, paginated) with whether each is already on the channel. */
export async function listAssignableProducts(channelId: string, query: ListQuery): Promise<Paginated<AssignableProduct>> {
  if (!isValidObjectId(channelId)) throw notFound("Channel");
  const filter: Filter = { status: "active", ...searchFilter(query.search, ["sku", "name", "barcode", "category"]) };
  if (query.filters.category) filter.category = query.filters.category;
  if (query.filters.hideAssigned === "1") {
    const assigned = await ChannelProductModel.find({ channel: channelId }).distinct("product");
    filter._id = { $nin: assigned };
  }
  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ name: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("sku name category sellingPricePaise")
      .lean(),
    Product.countDocuments(filter),
  ]);
  const ids = items.map((p) => p._id);
  const [stock, onChannel] = await Promise.all([
    stockFor(ids),
    ChannelProductModel.find({ channel: channelId, product: { $in: ids } }).distinct("product"),
  ]);
  const assignedSet = new Set(onChannel.map(String));
  return paginate(
    items.map((p) => ({
      _id: String(p._id),
      sku: p.sku,
      name: p.name,
      category: p.category,
      sellingPrice: fromPaise(p.sellingPricePaise),
      stock: stock.get(String(p._id)) ?? 0,
      assigned: assignedSet.has(String(p._id)),
    })),
    total,
    query
  );
}

/** Adds products to the channel; ones already assigned (or missing / inactive) are skipped. */
export async function assignProducts(
  channelId: string,
  productIds: string[],
  userId: string,
  allocations: { product: string; allocatedQty?: number | null }[] = []
) {
  await getChannel(channelId);
  const unique = [...new Set(productIds)];
  const valid = await Product.find({ _id: { $in: unique }, status: "active" }).select("_id sku").lean();
  const existing = new Set((await ChannelProductModel.find({ channel: channelId, product: { $in: valid.map((v) => v._id) } }).distinct("product")).map(String));
  const toAdd = valid.filter((p) => !existing.has(String(p._id)));
  const qtyOf = new Map(allocations.map((a) => [a.product, a.allocatedQty ?? null]));
  // Every assigned qty must fit the stock on hand (checked before anything is saved)
  for (const p of toAdd) await assertAllocatable(channelId, p, qtyOf.get(String(p._id)) ?? null);
  if (toAdd.length) {
    await ChannelProductModel.insertMany(
      toAdd.map((p) => ({ channel: channelId, product: p._id, allocatedQty: qtyOf.get(String(p._id)) ?? null, createdBy: userId })),
      { ordered: false }
    ).catch((e: { code?: number }) => {
      // A parallel assign of the same product — the other request won; nothing to do
      if (e?.code !== 11000) throw e;
    });
  }
  return { added: toAdd.length, skipped: unique.length - toAdd.length };
}

/** Removes listings (ChannelProduct ids) from the channel. Past orders keep their own copy of the product. */
export async function removeChannelProducts(channelId: string, ids: string[]) {
  if (!isValidObjectId(channelId)) throw notFound("Channel");
  const res = await ChannelProductModel.deleteMany({ channel: channelId, _id: { $in: ids.filter((i) => isValidObjectId(i)) } });
  return { removed: res.deletedCount };
}

export async function updateChannelProduct(channelId: string, id: string, input: ChannelProductInput): Promise<void> {
  if (!isValidObjectId(channelId) || !isValidObjectId(id)) throw notFound("Channel product");
  const row = await ChannelProductModel.findOne({ _id: id, channel: channelId }).populate<{ product: { _id: Types.ObjectId; sku: string } }>("product", "sku").lean();
  if (!row?.product) throw notFound("Channel product");
  const allocatedQty = input.allocatedQty ?? null;
  await assertAllocatable(channelId, row.product, allocatedQty);
  await ChannelProductModel.updateOne(
    { _id: id, channel: channelId },
    { $set: { channelSku: input.channelSku.trim(), channelPricePaise: toPaise(input.channelPrice), allocatedQty } }
  );
}

/** Channels a product is listed on (product detail page). */
export async function channelsForProduct(productId: string): Promise<{ _id: string; name: string; code: string; status: RecordStatus; channelSku: string; channelPrice: number }[]> {
  if (!isValidObjectId(productId)) return [];
  const rows = await ChannelProductModel.find({ product: productId })
    .populate<{ channel: ChannelDoc }>("channel", "name code status")
    .lean();
  return rows
    .filter((r) => r.channel)
    .map((r) => ({
      _id: String(r.channel._id),
      name: r.channel.name,
      code: r.channel.code,
      status: r.channel.status,
      channelSku: r.channelSku ?? "",
      channelPrice: fromPaise(r.channelPricePaise),
    }));
}
