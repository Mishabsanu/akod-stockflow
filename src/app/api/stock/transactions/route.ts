import { apiHandler } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { listStockTransactions, TXN_FILTERS } from "@/server/services/inventory.service";

/** Stock history: ?type= &from= &to= &poNumber= &product= &search= */
export const GET = apiHandler({ module: "stock", action: "view" }, async ({ req }) =>
  listStockTransactions(parseListQuery(req.nextUrl.searchParams, TXN_FILTERS))
);
