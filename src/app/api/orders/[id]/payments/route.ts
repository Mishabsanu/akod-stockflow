import { orderPaymentSchema } from "@/lib/validation/order.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { listOrderPayments, recordOrderPayment } from "@/server/services/order.service";

export const GET = apiHandler<{ id: string }>({ module: "order", action: "view" }, async ({ params }) => ({
  items: await listOrderPayments(params.id),
}));

/** Payment received against the order (or a refund paid on a cancelled / returned order). */
export const POST = apiHandler<{ id: string }>({ module: "payment", action: "create" }, async ({ req, params, user }) =>
  recordOrderPayment(params.id, await readBody(req, orderPaymentSchema), user)
);
