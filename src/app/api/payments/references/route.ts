import { apiHandler } from "@/server/http/handler";
import { listReferenceOptions } from "@/server/services/finance/payment.service";

/** Open orders / expenses a payment can settle: ?type=ORDER|EXPENSE&direction=RECEIVED|MADE&search= */
export const GET = apiHandler({ module: "payment", action: "create" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  return listReferenceOptions(sp.get("type") ?? "", sp.get("direction") ?? "", sp.get("search") ?? "");
});
