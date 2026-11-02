import { stockInSchema } from "@/lib/validation/stock.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { stockIn } from "@/server/services/inventory.service";

/** Stock Update: adds stock (PO number optional reference). Returns before / after quantities. */
export const POST = apiHandler({ module: "stock", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, stockInSchema);
  return stockIn(input, user);
});
