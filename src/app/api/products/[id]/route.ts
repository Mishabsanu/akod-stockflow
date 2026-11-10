import { productFormSchema } from "@/lib/validation/product.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteProduct, getProduct, updateProduct } from "@/server/services/product.service";

export const GET = apiHandler<{ id: string }>({ module: "product", action: "view" }, async ({ params }) => getProduct(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "product", action: "update" }, async ({ req, params, user }) => {
  const input = await readBody(req, productFormSchema);
  return updateProduct(params.id, input, user._id);
});

export const DELETE = apiHandler<{ id: string }>({ module: "product", action: "delete" }, async ({ params, user }) => {
  await deleteProduct(params.id, user._id);
  return { success: true };
});
