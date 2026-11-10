import { productSchema } from "@/lib/validation/product.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteProduct, getProduct, updateProduct } from "@/server/services/product.service";

export const GET = apiHandler<{ id: string }>({ module: "product", action: "view" }, async ({ params }) => getProduct(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "product", action: "update" }, async ({ req, params }) => {
  const input = await readBody(req, productSchema);
  return updateProduct(params.id, input);
});

export const DELETE = apiHandler<{ id: string }>({ module: "product", action: "delete" }, async ({ params, user }) => {
  await deleteProduct(params.id, user._id);
  return { success: true };
});
