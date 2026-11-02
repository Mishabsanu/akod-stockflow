import "server-only";
import { can } from "@/lib/permissions";
import { isDay } from "@/lib/indiaDate";
import { resolvePeriod } from "@/lib/periods";
import type { ReportGroup, ReportMeta, ReportResult } from "@/lib/reportTypes";
import type { SessionUser } from "@/lib/types";
import { AppError, notFound } from "../http/errors";
import { parseListQuery } from "../http/query";
import { inventoryReport, productReport, stockTransactionReport } from "./reports/catalog.reports";
import type { ReportCtx, ReportDef } from "./reports/engine";
import { cashFlowReport, financeRegisterReport, profitLossReport, salesRevenueReport } from "./reports/finance.reports";
import {
  distributorSalesSummaryReport,
  expenseReport,
  localSalesSummaryReport,
  marketplaceRevenueReport,
  payablesReport,
  receivablesReport,
} from "./reports/ledger.reports";
import { distributorSalesReport, localSalesReport, marketplaceSalesReport, orderReport } from "./reports/sales.reports";

/** Reports module (section 7) then Financial Reports (section 6G), in the order the hubs show them. */
const REPORTS: ReportDef[] = [
  productReport,
  inventoryReport,
  stockTransactionReport,
  orderReport,
  marketplaceSalesReport,
  localSalesReport,
  distributorSalesReport,
  financeRegisterReport,
  profitLossReport,
  cashFlowReport,
  salesRevenueReport,
  expenseReport,
  receivablesReport,
  payablesReport,
  marketplaceRevenueReport,
  localSalesSummaryReport,
  distributorSalesSummaryReport,
];

const BY_KEY = new Map(REPORTS.map((r) => [r.meta.key, r]));

/** Report cards for a hub page. Receivables / payables have their own Finance screens but are listed too. */
export function listReports(group: ReportGroup): ReportMeta[] {
  return REPORTS.filter((r) => r.meta.group === group).map((r) => r.meta);
}

export function getReportDef(key: string): ReportDef {
  const def = BY_KEY.get(key);
  if (!def) throw notFound("Report");
  return def;
}

export function canViewReport(user: SessionUser, def: ReportDef): boolean {
  return can(user, def.permission, "view");
}

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

const read = (p: Params, key: string): string => {
  if (p instanceof URLSearchParams) return p.get(key) ?? "";
  const v = p[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

/** Runs a report for the URL params of its screen (or export link). */
export async function runReport(def: ReportDef, params: Params, opts: { all?: boolean } = {}): Promise<ReportResult> {
  const filterSpecs = def.filters ? await def.filters() : [];
  const query = parseListQuery(params, filterSpecs.map((f) => f.key));
  const sort = def.sorts.find((s) => s.value === query.sort) ?? def.sorts[0];

  let range: ReportCtx["range"] = null;
  if (def.meta.dateMode === "required") {
    const p = resolvePeriod({ period: read(params, "period"), from: read(params, "from"), to: read(params, "to") });
    range = { from: p.from, to: p.to };
  } else if (def.meta.dateMode === "optional") {
    const from = read(params, "from");
    const to = read(params, "to");
    if (isDay(from) || isDay(to)) {
      const f = isDay(from) ? from : "2000-01-01";
      const t = isDay(to) ? to : "2999-12-31";
      range = f <= t ? { from: f, to: t } : { from: t, to: f };
    }
  }

  const ctx: ReportCtx = { search: query.search, filters: query.filters, range, sort, page: query.page, limit: query.limit, all: Boolean(opts.all) };
  const out = await def.run(ctx);
  // Statement-style reports (P&L) return every row: show them on one page
  const limit = out.rows.length > query.limit && !opts.all ? out.rows.length : query.limit;
  return {
    ...def.meta,
    columns: def.columns,
    rows: {
      items: out.rows,
      page: query.page,
      limit,
      total: out.total,
      totalPages: Math.max(1, Math.ceil(out.total / limit)),
    },
    summary: out.summary ?? [],
    filters: filterSpecs,
    sorts: def.sorts.map(({ value, label }) => ({ value, label })),
    range,
    chart: out.chart,
  };
}

/** For API routes: 403 unless the user may see the report. */
export function assertReportAccess(user: SessionUser, def: ReportDef): void {
  if (!canViewReport(user, def)) throw new AppError("You do not have permission to perform this action", 403);
}
