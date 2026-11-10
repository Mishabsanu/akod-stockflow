import { categorySchema } from "@/lib/validation/category.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createCategory, listCategoryPage } from "@/server/services/category.service";

export const GET = apiHandler({ module: "category", action: "view" }, async ({ req }) =>
  listCategoryPage(parseListQuery(req.nextUrl.searchParams))
);

export const POST = apiHandler({ module: "category", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, categorySchema);
  return createCategory(input, user._id);
});
