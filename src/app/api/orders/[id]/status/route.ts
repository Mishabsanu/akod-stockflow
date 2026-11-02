import type { OrderStatus } from "@/lib/commerceTypes";
import { statusChangeSchema } from "@/lib/validation/order.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { getOrder } from "@/server/services/order.service";
import { changeOrderStatus } from "@/server/services/orderFlow.service";

/** Confirm / Processing / Complete / Cancel / Return (see ORDER_TRANSITIONS). */
export const POST = apiHandler<{ id: string }>({ module: "order", action: "update" }, async ({ req, params, user }) => {
  const input = await readBody(req, statusChangeSchema);
  await changeOrderStatus(
    params.id,
    {
      status: input.status as OrderStatus,
      note: input.note,
      courier: input.courier || undefined,
      trackingNumber: input.trackingNumber || undefined,
    },
    user
  );
  return getOrder(params.id);
});
