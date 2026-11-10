import type { RecordStatus } from "./types";

/**
 * A manufacturing unit (own plant or co-packer) and the batch-code prefixes printed on its packs.
 * Looking up the first characters of a pack's batch code (e.g. "27") tells which unit made it.
 * Standalone: not linked to products, stock or orders.
 */
export interface Manufacturer {
  _id: string;
  name: string;
  address: string;
  /** FSSAI licence number (14 digits) */
  fssaiLicNo: string;
  /** Batch-code prefixes, e.g. ["27", "28", "29"] */
  batchCodes: string[];
  phone?: string;
  notes?: string;
  status: RecordStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchLookupResult {
  /** The code that matched (the typed text, or its longest known prefix) */
  matchedCode: string;
  manufacturer: Manufacturer;
}

export const BATCH_CODE_PATTERN = /^[A-Z0-9]{1,10}$/;

/** "27, 28 29;30" → ["27","28","29","30"]; "27-33" expands to 27…33 (numeric ranges up to 200 codes). */
export function parseBatchCodes(text: string): string[] {
  const out: string[] = [];
  for (const part of text.toUpperCase().split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      const width = range[1].length;
      if (to >= from && to - from < 200) {
        for (let n = from; n <= to; n++) out.push(String(n).padStart(width, "0"));
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

/** Natural order: 2, 9, 27, 100, A1 … */
export const sortBatchCodes = (codes: string[]) =>
  [...codes].sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));
