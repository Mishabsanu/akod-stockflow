import { orderSchema } from "@/lib/validation/order.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteOrder, getOrder, updateOrder } from "@/server/services/order.service";

export const GET = apiHandler<{ id: string }>({ module: "order", action: "view" }, async ({ params }) => getOrder(params.id));

/** Pending orders only. */
export const PUT = apiHandler<{ id: string }>({ module: "order", action: "update" }, async ({ req, params, user }) =>
  updateOrder(params.id, await readBody(req, orderSchema), user)
);

/** Pending orders only — confirmed orders are cancelled instead. */
export const DELETE = apiHandler<{ id: string }>({ module: "order", action: "delete" }, async ({ params, user }) => {
  await deleteOrder(params.id, user._id);
  return { success: true };
});
