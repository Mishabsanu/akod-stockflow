import { resolvePeriod } from "@/lib/periods";
import { apiHandler } from "@/server/http/handler";
import { getFinanceDashboard } from "@/server/services/finance/dashboard.service";

/** Finance dashboard figures: ?period=today|week|month|year|custom&from=&to= */
export const GET = apiHandler({ module: "finance_dashboard", action: "view" }, async ({ req }) => {
  const q = req.nextUrl.searchParams;
  const p = resolvePeriod({ period: q.get("period") ?? "", from: q.get("from") ?? "", to: q.get("to") ?? "" });
  return getFinanceDashboard({ from: p.from, to: p.to });
});
