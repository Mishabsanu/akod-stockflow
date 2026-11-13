import { apiHandler } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { listAllAssignable, listAssignableProducts } from "@/server/services/channel.service";

/**
 * Assign Products: active products with `assigned` flag.
 * `?all=1` → `{ items }` with every product and its photo (no paging); otherwise paged (?search= &page= …).
 */
export const GET = apiHandler<{ id: string }>({ module: "channel", action: "update" }, async ({ req, params }) =>
  req.nextUrl.searchParams.get("all") === "1"
    ? { items: await listAllAssignable(params.id) }
    : listAssignableProducts(params.id, parseListQuery(req.nextUrl.searchParams, ["category", "hideAssigned"]))
);
