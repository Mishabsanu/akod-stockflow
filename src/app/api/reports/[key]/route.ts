import { apiHandler } from "@/server/http/handler";
import { assertReportAccess, getReportDef, runReport } from "@/server/services/report.service";

/** Report rows as JSON, same URL params as the report screen (page, limit, search, sort, filters, period/from/to). */
export const GET = apiHandler<{ key: string }>("authenticated", async ({ req, user, params }) => {
  const def = getReportDef(params.key);
  assertReportAccess(user, def);
  return runReport(def, req.nextUrl.searchParams);
});
