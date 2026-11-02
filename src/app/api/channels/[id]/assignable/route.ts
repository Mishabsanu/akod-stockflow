import { apiHandler } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { listAssignableProducts } from "@/server/services/channel.service";

/** Assign Products modal: active products with `assigned` flag (?search= &category= &hideAssigned=1 &page= &limit=). */
export const GET = apiHandler<{ id: string }>({ module: "channel", action: "update" }, async ({ req, params }) =>
  listAssignableProducts(params.id, parseListQuery(req.nextUrl.searchParams, ["category", "hideAssigned"]))
);
