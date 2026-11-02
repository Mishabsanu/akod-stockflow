import { apiHandler } from "@/server/http/handler";
import { deletePayment, getPayment } from "@/server/services/finance/payment.service";

export const GET = apiHandler<{ id: string }>({ module: "payment", action: "view" }, async ({ params }) => getPayment(params.id));

export const DELETE = apiHandler<{ id: string }>({ module: "payment", action: "delete" }, async ({ params }) => {
  await deletePayment(params.id);
  return { success: true };
});
