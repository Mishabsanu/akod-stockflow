/**
 * Report engine contract shared by the server (report definitions, CSV export) and the
 * generic report screen. Columns are data, not render functions, so one client component
 * renders every report and the CSV export uses exactly the same columns.
 */
import type { Option, Paginated } from "./types";

export type ReportFormat = "text" | "mono" | "money" | "number" | "signed" | "date" | "badge";

export interface ReportColumn {
  key: string;
  label: string;
  format?: ReportFormat;
  align?: "left" | "center" | "right";
  hiddenByDefault?: boolean;
}

export type ReportCell = string | number | null;

export interface ReportRow {
  _id: string;
  /** Opens the record (order, product …) */
  href?: string;
  /** Optional action link, e.g. "Record payment" */
  actionHref?: string;
  actionLabel?: string;
  /** Badge colour for format "badge" columns */
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "brand";
  [key: string]: ReportCell | undefined;
}

export interface ReportSummaryItem {
  label: string;
  value: number;
  format: "money" | "number";
  tone?: "in" | "out" | "neutral";
}

export interface ReportFilterSpec {
  key: string;
  allLabel: string;
  options: Option[];
}

export type ReportGroup = "reports" | "finance";

export interface ReportMeta {
  key: string;
  group: ReportGroup;
  title: string;
  description: string;
  /** none = no date filter; required = always a range (default this month); optional = blank means all dates */
  dateMode: "none" | "required" | "optional";
  searchPlaceholder: string;
}

export interface ReportResult extends ReportMeta {
  columns: ReportColumn[];
  rows: Paginated<ReportRow>;
  summary: ReportSummaryItem[];
  filters: ReportFilterSpec[];
  sorts: Option[];
  range: { from: string; to: string } | null;
  /** Optional trend shown above the table (same unit: rupees) */
  chart?: { title: string; series: { key: string; label: string }[]; points: Record<string, string | number>[] };
}
