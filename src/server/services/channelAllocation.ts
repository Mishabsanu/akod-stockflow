import "server-only";
import { Types } from "mongoose";
import { SALE_STATUSES } from "@/lib/commerceTypes";
import { formatNumber } from "@/lib/format";
import { Channel } from "../models/Channel";
import { ChannelProduct } from "../models/ChannelProduct";
import { Order } from "../models/Order";
import { AppError } from "../http/errors";
import { stockFor } from "./stock.service";

/**
 * Marketplace selling limits. A product assigned to a marketplace may carry an "Assigned Qty":
 * the most that marketplace may sell. Stock stays in central inventory; "Sold" is always derived
 * from that marketplace's confirmed / shipped / delivered / completed orders, so cancelling or
 * returning an order gives the quantity back automatically. No assigned qty = no limit.
 */

const oid = (id: Types.ObjectId | string) => (typeof id === "string" ? new Types.ObjectId(id) : id);

/** Units sold on a marketplace per product (sale-status orders only). */
export async function channelSold(channelId: Types.ObjectId | string, productIds?: (Types.ObjectId | string)[]): Promise<Map<string, number>> {
  const rows = await Order.aggregate<{ _id: Types.ObjectId; qty: number }>([
    { $match: { orderType: "MARKETPLACE", channel: oid(channelId), status: { $in: SALE_STATUSES } } },
    { $unwind: "$items" },
    ...(productIds ? [{ $match: { "items.product": { $in: productIds.map(oid) } } }] : []),
    { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.qty]));
}

/** Remaining = assigned − sold (never below 0); null when the product has no limit. */
export function remainingOf(allocatedQty: number | null | undefined, sold: number): number | null {
  if (allocatedQty === null || allocatedQty === undefined) return null;
  return Math.max(allocatedQty - sold, 0);
}

/**
 * Checks a new assigned qty: it cannot be below what was already sold there, and the part still
 * to sell (assigned − sold) cannot be more than the stock actually on hand.
 */
export async function assertAllocatable(
  channelId: Types.ObjectId | string,
  product: { _id: Types.ObjectId | string; sku: string },
  allocatedQty: number | null
): Promise<void> {
  if (allocatedQty === null) return;
  const [sold, stock] = await Promise.all([channelSold(channelId, [product._id]), stockFor([product._id])]);
  const soldQty = sold.get(String(product._id)) ?? 0;
  const onHand = stock.get(String(product._id)) ?? 0;
  if (allocatedQty < soldQty) {
    throw new AppError(`${product.sku}: ${formatNumber(soldQty)} already sold on this marketplace — assign at least that`, 422, {
      allocatedQty: `At least ${soldQty}`,
    });
  }
  if (allocatedQty - soldQty > onHand) {
    throw new AppError(
      `${product.sku}: only ${formatNumber(onHand)} in stock — you can assign up to ${formatNumber(onHand + soldQty)}`,
      422,
      { allocatedQty: `At most ${onHand + soldQty}` }
    );
  }
}

/** Confirming a marketplace order: every limited line must fit in what is left of its assigned qty. */
export async function assertWithinAllocation(channelId: Types.ObjectId | string, need: Map<string, { sku: string; qty: number }>): Promise<void> {
  const ids = [...need.keys()];
  const limited = await ChannelProduct.find({ channel: channelId, product: { $in: ids }, allocatedQty: { $ne: null } })
    .select("product allocatedQty")
    .lean();
  if (!limited.length) return;
  const [sold, channel] = await Promise.all([
    channelSold(channelId, limited.map((l) => l.product)),
    Channel.findById(channelId).select("name").lean(),
  ]);
  const over = limited
    .map((l) => {
      const n = need.get(String(l.product))!;
      const left = remainingOf(l.allocatedQty, sold.get(String(l.product)) ?? 0) ?? 0;
      return n.qty > left ? `${n.sku} (need ${n.qty}, ${left} left)` : null;
    })
    .filter(Boolean);
  if (over.length) {
    throw new AppError(`Above the quantity assigned to ${channel?.name ?? "this marketplace"}: ${over.join(", ")}`, 409);
  }
}

/** What the marketplace order form may still sell per product: min(central stock, remaining assigned). */
export async function sellableOnChannel(
  channelId: Types.ObjectId | string,
  rows: { productId: string; stock: number; allocatedQty: number | null | undefined }[]
): Promise<Map<string, number>> {
  const limited = rows.filter((r) => r.allocatedQty !== null && r.allocatedQty !== undefined);
  const sold = limited.length ? await channelSold(channelId, limited.map((r) => r.productId)) : new Map<string, number>();
  return new Map(
    rows.map((r) => {
      const left = remainingOf(r.allocatedQty, sold.get(r.productId) ?? 0);
      return [r.productId, left === null ? r.stock : Math.min(r.stock, left)];
    })
  );
}
