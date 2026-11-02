import { readRange, thisMonth } from "@/lib/dateRange";
import { apiHandler } from "@/server/http/handler";
import { getLedger } from "@/server/services/finance/ledger.service";

/** ?account=<id>&from=&to= (no account = all accounts). */
export const GET = apiHandler({ module: "account", action: "view" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const range = readRange(sp.get("from") ?? undefined, sp.get("to") ?? undefined, thisMonth());
  return getLedger(sp.get("account") || undefined, range);
});
