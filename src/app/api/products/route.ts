import { can } from "@/lib/permissions";
import { productSchema } from "@/lib/validation/product.schema";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createProduct, listProducts, listSellableProducts } from "@/server/services/product.service";

/**
 * GET list (search, status, category, page) — or `?options=1` for order forms / pickers:
 * `{ items: { productId, sku, name, price, stock }[] }` of active products (`&inStock=1` keeps only those with stock).
 * Options are readable with order:view or stock:view too (order forms, stock pickers).
 */
export const GET = apiHandler("authenticated", async ({ req, user }) => {
  const params = req.nextUrl.searchParams;
  const forPicker = params.get("options") === "1";
  const allowed = can(user, "product", "view") || (forPicker && (can(user, "order", "view") || can(user, "stock", "view")));
  if (!allowed) throw new AppError("You do not have permission to perform this action", 403);
  if (forPicker) {
    return { items: await listSellableProducts({ inStock: params.get("inStock") === "1", search: params.get("search") ?? "" }) };
  }
  return listProducts(parseListQuery(params, ["category", "freeDelivery"]));
});

export const POST = apiHandler({ module: "product", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, productSchema);
  return createProduct(input, user._id);
});
