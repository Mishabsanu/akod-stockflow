import { ORDER_TYPES, type OrderType } from "@/lib/commerceTypes";
import { resolvePeriod } from "@/lib/periods";
import { apiHandler } from "@/server/http/handler";
import { getDashboard } from "@/server/services/dashboard.service";

/** Main dashboard figures: ?period=today|week|month|year|custom&from=&to=&orderType= */
export const GET = apiHandler("authenticated", async ({ req }) => {
  const q = req.nextUrl.searchParams;
  const p = resolvePeriod({ period: q.get("period") ?? "", from: q.get("from") ?? "", to: q.get("to") ?? "" });
  const type = (ORDER_TYPES as readonly string[]).includes(q.get("orderType") ?? "") ? (q.get("orderType") as OrderType) : "";
  return getDashboard({ from: p.from, to: p.to }, type);
});
