import { shipmentSchema } from "@/lib/validation/order.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { getOrder } from "@/server/services/order.service";
import { updateShipment } from "@/server/services/orderFlow.service";

/** Courier + tracking number; a tracking number on a confirmed order moves it to Shipped. */
export const PUT = apiHandler<{ id: string }>({ module: "order", action: "update" }, async ({ req, params, user }) => {
  await updateShipment(params.id, await readBody(req, shipmentSchema), user);
  return getOrder(params.id);
});
