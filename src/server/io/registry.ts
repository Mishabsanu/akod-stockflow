import "server-only";
import { ValidationError } from "yup";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { AppError, notFound } from "../http/errors";
import { productsIo } from "./catalog.io";
import { channelProductsIo, channelsIo } from "./channel.io";
import { inventoryIo, stockTransactionsIo, stockUploadIo } from "./inventory.io";
import { buildCsv, buildWorkbook, headerKey, readUpload, type CellValue } from "./sheet";
import type { ImportContext, ImportPreviewRow, ImportRecord, ImportResult, IoEntity } from "./types";

/**
 * Every list screen that can export / import, keyed by the URL segment used in /api/io/<entity>.
 * To add one: write an IoEntity in its own *.io.ts file and add it here.
 */
const ENTITIES: Record<string, IoEntity<never>> = {
  products: productsIo,
  inventory: inventoryIo,
  "stock-transactions": stockTransactionsIo,
  "stock-upload": stockUploadIo,
  channels: channelsIo,
  "channel-products": channelProductsIo,
} as unknown as Record<string, IoEntity<never>>;

export function getEntity(key: string, user: SessionUser, mode: "export" | "import"): IoEntity<never> {
  const entity = ENTITIES[key];
  if (!entity) throw notFound("Export");
  const allowed =
    mode === "export"
      ? can(user, entity.module, "view")
      : Boolean(entity.importRow) && (entity.importNeeds ?? ["create", "update"]).every((a) => can(user, entity.module, a));
  if (!allowed) throw new AppError("You do not have permission to perform this action", 403);
  return entity;
}

const stamp = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export type ExportFormat = "csv" | "xlsx";

/** Download of a list (same filters as the screen). `blank` gives a template with only the headings. */
export async function exportEntity(entity: IoEntity<never>, params: URLSearchParams, blank = false, format: ExportFormat = "xlsx") {
  const rows = blank ? [] : await entity.rows(params);
  // Templates hold only the columns the importer reads
  const columns = blank ? entity.columns.filter((c) => c.field) : entity.columns;
  const grid = rows.map((r) => columns.map((c) => c.value(r)));
  const base = `${entity.fileName}_${blank ? "Template" : stamp()}`;
  if (format === "csv") {
    return { buffer: buildCsv(columns.map((c) => c.header), grid), filename: `${base}.csv`, format };
  }
  const buffer = await buildWorkbook(
    entity.title,
    columns.map((c) => ({ header: c.header, width: c.width })),
    grid
  );
  return { buffer, filename: `${base}.xlsx`, format };
}

/** "₹1,250.50" → 1250.5 ; "5%" → 5 ; leaves non-numbers as text so validation can report them. */
function cleanNumber(value: CellValue): string | number {
  if (typeof value === "number") return value;
  const text = String(value).replace(/[₹,%\s]/g, "").replace(/^rs\.?/i, "");
  return text !== "" && !Number.isNaN(Number(text)) ? Number(text) : String(value);
}

function rowError(error: unknown): string {
  const err = error as { code?: number; keyPattern?: Record<string, unknown> };
  if (err?.code === 11000) return `Duplicate ${Object.keys(err.keyPattern ?? {})[0] ?? "value"}`;
  if (error instanceof AppError) return error.message;
  if (error instanceof ValidationError) return error.errors[0];
  return "Could not save this row";
}

/**
 * Runs every row; a bad row is reported with its Excel row number and the rest still import.
 * With `dryRun` nothing is written: the result is a preview of what each row would do.
 */
export async function importEntity(entity: IoEntity<never>, file: File, user: SessionUser, dryRun = false): Promise<ImportResult> {
  const { headers, rows } = await readUpload(file);
  const byKey = new Map<string, (typeof entity.columns)[number]>();
  for (const col of entity.columns) {
    if (!col.field) continue;
    for (const name of [col.header, ...(col.aliases ?? [])]) byKey.set(headerKey(name), col);
  }
  const ignored = headers.filter((h) => h && !byKey.has(headerKey(h)));
  const requiredField = entity.requiredField ?? (entity.columns.some((c) => c.field === "sku") ? "sku" : null);
  if (requiredField && !headers.some((h) => byKey.get(headerKey(h))?.field === requiredField)) {
    const col = entity.columns.find((c) => c.field === requiredField);
    throw new AppError(`The file needs a "${col?.header ?? requiredField}" column`, 422);
  }

  const ctx: ImportContext = { dryRun, scratch: new Map() };
  const result: ImportResult = { dryRun, total: rows.length, created: 0, updated: 0, errors: [], rows: [], ignored };
  for (const row of rows) {
    const record: ImportRecord = {};
    for (const [key, value] of Object.entries(row.values)) {
      const col = byKey.get(key);
      if (!col?.field || value === null || value === undefined || String(value).trim() === "") continue;
      record[col.field] = col.numeric ? cleanNumber(value) : typeof value === "number" ? String(value) : value;
    }
    try {
      const raw = await entity.importRow!(record, user, ctx);
      const res = typeof raw === "string" ? { outcome: raw } : raw;
      result[res.outcome] += 1;
      result.rows.push({ line: row.line, outcome: res.outcome, label: res.label, detail: res.detail } satisfies ImportPreviewRow);
    } catch (error) {
      const message = rowError(error);
      result.errors.push({ line: row.line, message });
      result.rows.push({ line: row.line, outcome: "error", label: String(record[requiredField ?? ""] ?? ""), message });
    }
  }
  return result;
}
