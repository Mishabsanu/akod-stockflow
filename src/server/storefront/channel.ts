import "server-only";
import { Channel } from "../models/Channel";
import { ChannelProduct } from "../models/ChannelProduct";

/**
 * The online store (akod-food / www.akod.in) is the marketplace with this code (Marketplaces → AKOD IN).
 * Only products assigned to it are shown on the store, and website orders are saved as its orders.
 */
export const STORE_CHANNEL_CODE = (process.env.STOREFRONT_CHANNEL_CODE || "AKODIN").trim().toUpperCase();

export async function storeChannel() {
  return Channel.findOne({ code: STORE_CHANNEL_CODE }).select("_id name code status").lean();
}

/**
 * Products assigned to the store's marketplace → channel price in paise (0 = use the selling price).
 * `null` when no marketplace with that code exists (then the store shows every storefront product);
 * an empty map when it is inactive (nothing is sold on the store).
 */
export async function storeChannelListing(): Promise<Map<string, number> | null> {
  const ch = await storeChannel();
  if (!ch) {
    console.warn(`[storefront] No marketplace with code ${STORE_CHANNEL_CODE}: the store shows all storefront products`);
    return null;
  }
  if (ch.status !== "active") return new Map();
  const rows = await ChannelProduct.find({ channel: ch._id }).select("product channelPricePaise").lean();
  return new Map(rows.map((r) => [String(r.product), r.channelPricePaise || 0]));
}
