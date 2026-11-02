import { orderSchema } from "@/lib/validation/order.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createOrder, listOrders, ORDER_FILTERS } from "@/server/services/order.service";

export const GET = apiHandler({ module: "order", action: "view" }, async ({ req }) =>
  listOrders(parseListQuery(req.nextUrl.searchParams, ORDER_FILTERS))
);

/** Creates a draft; with confirm=true also confirms it (result.confirmError explains a failed confirm). */
export const POST = apiHandler({ module: "order", action: "create" }, async ({ req, user }) =>
  createOrder(await readBody(req, orderSchema), user)
);
