import { can } from "@/lib/permissions";
import { assignProductsSchema, removeChannelProductsSchema } from "@/lib/validation/channel.schema";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import {
  assignProducts,
  CHANNEL_PRODUCT_FILTERS,
  listChannelProductOptions,
  listChannelProducts,
  removeChannelProducts,
} from "@/server/services/channel.service";

type P = { id: string };

/**
 * GET assigned products (search, category, page) — or `?options=1` for the marketplace order form:
 * `{ items: { productId, sku, name, price, stock }[] }` (active products only; price = channel price or selling price).
 * Readable with order:view too, so order takers need no channel permission.
 */
export const GET = apiHandler<P>("authenticated", async ({ req, params, user }) => {
  const search = req.nextUrl.searchParams;
  const forOrders = search.get("options") === "1";
  const allowed = can(user, "channel", "view") || (forOrders && can(user, "order", "view"));
  if (!allowed) throw new AppError("You do not have permission to perform this action", 403);
  if (forOrders) return { items: await listChannelProductOptions(params.id) };
  return listChannelProducts(params.id, parseListQuery(search, CHANNEL_PRODUCT_FILTERS));
});

/** Assign products: `{ productIds: string[] }` → `{ added, skipped }`. */
export const POST = apiHandler<P>({ module: "channel", action: "update" }, async ({ req, params, user }) => {
  const { productIds } = await readBody(req, assignProductsSchema);
  return assignProducts(params.id, productIds, user._id);
});

/** Remove listings: `{ ids: string[] }` (channel-product ids) → `{ removed }`. */
export const DELETE = apiHandler<P>({ module: "channel", action: "update" }, async ({ req, params }) => {
  const { ids } = await readBody(req, removeChannelProductsSchema);
  return removeChannelProducts(params.id, ids);
});
