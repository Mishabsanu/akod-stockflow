import "server-only";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { AppError } from "../http/errors";

export type CellValue = string | number | null | undefined;

export interface SheetColumn {
  header: string;
  width?: number;
}

/** Styled .xlsx: purple header row, frozen, sized columns — same look as the app. */
export async function buildWorkbook(sheetName: string, columns: SheetColumn[], rows: CellValue[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AKOD Commerce";
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5439A3" } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  for (const row of rows) ws.addRow(row.map((v) => (v === undefined ? null : v)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** CSV with a BOM so Excel opens ₹ and other non-ASCII text correctly. */
export function buildCsv(headers: string[], rows: CellValue[][]): Buffer {
  const cell = (v: CellValue) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Quote when needed; prefix formula-like text so spreadsheet apps do not execute it
    const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
}

const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

export function fileResponse(buffer: Buffer, filename: string, format: "xlsx" | "csv" = "xlsx"): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Header text → comparison key: "Units per Carton" and "units_per_carton" both become "unitspercarton". */
export const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Any ExcelJS cell value (formula, rich text, hyperlink, date) → plain string / number. */
function plain(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return plain(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("text" in value) return String(value.text);
  }
  return String(value);
}

/** Minimal RFC 4180 CSV parser (quotes, "" escapes, CRLF, BOM). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export interface ParsedRow {
  /** Row number as the user sees it in Excel (header is row 1) */
  line: number;
  /** Values by headerKey */
  values: Record<string, CellValue>;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

/** Reads the first sheet of an uploaded .xlsx or .csv into rows keyed by header. Blank rows are skipped. */
export async function readUpload(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  if (file.size > MAX_BYTES) throw new AppError("File is larger than 5 MB", 413);
  const name = file.name.toLowerCase();
  let grid: CellValue[][];
  if (name.endsWith(".csv")) {
    grid = parseCsv(await file.text());
  } else if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new AppError("Could not read this Excel file. Save it as .xlsx and try again.", 422);
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new AppError("The file has no sheets", 422);
    grid = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const values: CellValue[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        values[col - 1] = plain(cell.value);
      });
      grid[n - 1] = values;
    });
  } else {
    throw new AppError("Upload an Excel (.xlsx) or CSV file", 422);
  }

  const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim());
  if (headers.every((h) => !h)) throw new AppError("The first row must contain the column headings", 422);
  const keys = headers.map(headerKey);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];
    if (cells.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    const values: Record<string, CellValue> = {};
    keys.forEach((k, col) => {
      if (k) values[k] = typeof cells[col] === "string" ? (cells[col] as string).trim() : cells[col];
    });
    rows.push({ line: i + 1, values });
  }
  if (rows.length > MAX_ROWS) throw new AppError(`Too many rows (max ${MAX_ROWS} per file)`, 413);
  return { headers, rows };
}
