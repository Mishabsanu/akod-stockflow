import { categorySchema } from "@/lib/validation/category.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteCategory, getCategory, updateCategory } from "@/server/services/category.service";

export const GET = apiHandler<{ id: string }>({ module: "category", action: "view" }, async ({ params }) => getCategory(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "category", action: "update" }, async ({ req, params }) => {
  const input = await readBody(req, categorySchema);
  return updateCategory(params.id, input);
});

export const DELETE = apiHandler<{ id: string }>({ module: "category", action: "delete" }, async ({ params }) => {
  await deleteCategory(params.id);
  return { success: true };
});
