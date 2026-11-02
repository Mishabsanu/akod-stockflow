import { apiHandler } from "@/server/http/handler";
import { assertReportAccess, getReportDef, runReport } from "@/server/services/report.service";

/** Receivables list as JSON (search, orderType / category, aging, from / to, sort, page, limit). */
export const GET = apiHandler("authenticated", async ({ req, user }) => {
  const def = getReportDef("receivables");
  assertReportAccess(user, def);
  return runReport(def, req.nextUrl.searchParams);
});
