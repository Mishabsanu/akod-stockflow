import { apiHandler } from "@/server/http/handler";
import { csvResponse, reportFileName, reportToCsv } from "@/server/io/reports.io";
import { assertReportAccess, getReportDef, runReport } from "@/server/services/report.service";

/** CSV download of a report: every matching row (up to 10,000) for the current filters. */
export const GET = apiHandler<{ key: string }>("authenticated", async ({ req, user, params }) => {
  const def = getReportDef(params.key);
  assertReportAccess(user, def);
  const report = await runReport(def, req.nextUrl.searchParams, { all: true });
  return csvResponse(reportToCsv(report), reportFileName(report));
});
