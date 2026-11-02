import { productSchema } from "@/lib/validation/product.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createProduct, listProducts, listSellableProducts } from "@/server/services/product.service";

/**
 * GET list (search, status, category, page) — or `?options=1` for order forms / pickers:
 * `{ items: { productId, sku, name, price, stock }[] }` of active products (`&inStock=1` keeps only those with stock).
 */
export const GET = apiHandler({ module: "product", action: "view" }, async ({ req }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("options") === "1") {
    return { items: await listSellableProducts({ inStock: params.get("inStock") === "1", search: params.get("search") ?? "" }) };
  }
  return listProducts(parseListQuery(params, ["category"]));
});

export const POST = apiHandler({ module: "product", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, productSchema);
  return createProduct(input, user._id);
});
