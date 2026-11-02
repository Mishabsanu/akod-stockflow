import "server-only";
import type { PermissionAction, PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import type { CellValue } from "./sheet";

export interface IoColumn<T> {
  header: string;
  width?: number;
  /** Value written on export */
  value: (row: T) => CellValue;
  /** Field name this column fills on import; omit for export-only columns */
  field?: string;
  /** Other header spellings accepted on import */
  aliases?: string[];
  /** Numbers, money, percentages: "1,250", "₹10", "5%" are cleaned on import */
  numeric?: boolean;
}

/** One record from an import file: only the cells that had a value (blank = keep existing). */
export type ImportRecord = Record<string, string | number>;

export type ImportOutcome = "created" | "updated";

/** What one row did (or would do, in a dry run). */
export interface ImportRowResult {
  outcome: ImportOutcome;
  /** Short identifier shown in the preview, e.g. the SKU */
  label?: string;
  /** e.g. "Stock 120 → 170" */
  detail?: string;
}

export interface ImportContext {
  /** Preview only: validate and describe, but write nothing */
  dryRun: boolean;
  /** Shared by all rows of one upload (e.g. running stock when one SKU appears twice in a dry run) */
  scratch: Map<string, unknown>;
  /** Query string of the upload request, e.g. ?channel=<id> for channel imports */
  params: URLSearchParams;
}

export interface IoEntity<T> {
  title: string;
  /** Permission: export needs view; import needs `importNeeds` (default create + update) */
  module: PermissionModule;
  importNeeds?: PermissionAction[];
  fileName: string;
  columns: IoColumn<T>[];
  /** Column that must be present in an import file (field name), e.g. "sku" */
  requiredField?: string;
  /** All rows matching the list screen's filters (URL search params) */
  rows: (params: URLSearchParams) => Promise<T[]>;
  /** Creates or updates one record; throws with a readable message when the row is wrong. Must not write when ctx.dryRun. */
  importRow?: (record: ImportRecord, user: SessionUser, ctx: ImportContext) => Promise<ImportOutcome | ImportRowResult>;
}

export interface ImportPreviewRow {
  line: number;
  outcome: ImportOutcome | "error";
  label?: string;
  detail?: string;
  message?: string;
}

export interface ImportResult {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
  /** Every row's outcome (preview table) */
  rows: ImportPreviewRow[];
  /** Headers in the file that matched no column (ignored) */
  ignored: string[];
}
