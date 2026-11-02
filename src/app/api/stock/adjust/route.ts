import { adjustmentSchema } from "@/lib/validation/stock.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { adjustStock } from "@/server/services/inventory.service";

/** Stock Adjustment (+ / −) with a reason. */
export const POST = apiHandler({ module: "stock", action: "update" }, async ({ req, user }) => {
  const input = await readBody(req, adjustmentSchema);
  return adjustStock(input, user);
});
