import { apiHandler } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { INVENTORY_FILTERS, inventorySummary, listInventory } from "@/server/services/inventory.service";

/** Stock Overview: products with central stock and level (?level=IN_STOCK|LOW_STOCK|OUT_OF_STOCK|ALERT). ?summary=1 for the totals. */
export const GET = apiHandler({ module: "stock", action: "view" }, async ({ req }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("summary") === "1") return inventorySummary();
  return listInventory(parseListQuery(params, INVENTORY_FILTERS));
});
