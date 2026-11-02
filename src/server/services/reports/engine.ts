import "server-only";
import type { PermissionModule } from "@/lib/permissions";
import type { ReportColumn, ReportFilterSpec, ReportMeta, ReportResult, ReportRow, ReportSummaryItem } from "@/lib/reportTypes";
import type { Option } from "@/lib/types";
import { escapeRegex, type Filter } from "../../http/query";

export interface SortOption extends Option {
  /** Row field (in-memory reports) or Mongo field (DB-paginated reports) */
  field: string;
  dir: 1 | -1;
}

export interface ReportCtx {
  search: string;
  filters: Record<string, string>;
  range: { from: string; to: string } | null;
  sort: SortOption;
  page: number;
  limit: number;
  /** CSV export: every row, no paging */
  all: boolean;
}

export interface ReportOutput {
  rows: ReportRow[];
  /** Total matching rows (before paging) */
  total: number;
  summary?: ReportSummaryItem[];
  chart?: ReportResult["chart"];
}

export interface ReportDef {
  meta: ReportMeta;
  permission: PermissionModule;
  columns: ReportColumn[];
  sorts: SortOption[];
  /** URL filter keys this report reads, with their options */
  filters?: () => Promise<ReportFilterSpec[]>;
  run: (ctx: ReportCtx) => Promise<ReportOutput>;
}

export const EXPORT_LIMIT = 10000;

export const rupees = (paise: number | null | undefined) => Math.round(Number(paise) || 0) / 100;

export const sortOpt = (value: string, label: string, field: string, dir: 1 | -1): SortOption => ({ value, label, field, dir });

/** Sorts and pages rows already computed in memory (grouped / aggregated reports). */
export function pageRows(rows: ReportRow[], ctx: ReportCtx): ReportOutput {
  const { field, dir } = ctx.sort;
  const sorted = [...rows].sort((a, b) => {
    const x = a[field] ?? "";
    const y = b[field] ?? "";
    if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
    return String(x).localeCompare(String(y)) * dir;
  });
  const total = sorted.length;
  const items = ctx.all ? sorted.slice(0, EXPORT_LIMIT) : sorted.slice((ctx.page - 1) * ctx.limit, ctx.page * ctx.limit);
  return { rows: items, total };
}

/** Keeps rows whose text fields contain the search term. */
export function searchRows(rows: ReportRow[], search: string, fields: string[]): ReportRow[] {
  if (!search) return rows;
  const re = new RegExp(escapeRegex(search), "i");
  return rows.filter((r) => fields.some((f) => re.test(String(r[f] ?? ""))));
}

/** Mongo regex $or for DB-paginated reports. */
export function searchMatch(search: string, fields: string[]): Filter {
  if (!search) return {};
  const re = new RegExp(escapeRegex(search), "i");
  return { $or: fields.map((f) => ({ [f]: re })) };
}

/** Day-string field inside the report range. */
export function dayMatch(field: string, range: ReportCtx["range"]): Filter {
  return range ? { [field]: { $gte: range.from, $lte: range.to } } : {};
}

/** skip / limit for DB-paginated reports. */
export const window = (ctx: ReportCtx) =>
  ctx.all ? { skip: 0, limit: EXPORT_LIMIT } : { skip: (ctx.page - 1) * ctx.limit, limit: ctx.limit };

/** Today minus a day string, in whole days. */
export function ageInDays(day: string, today: string): number {
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
}

export function agingBucket(dueDay: string, today: string): string {
  const age = ageInDays(dueDay, today);
  if (age < 0) return "Not due";
  if (age <= 30) return "0-30 days";
  if (age <= 60) return "31-60 days";
  if (age <= 90) return "61-90 days";
  return "90+ days";
}
