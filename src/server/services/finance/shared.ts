import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { isDay } from "@/lib/indiaDate";
import type { Filter, ListQuery } from "../../http/query";

/** ?from=&to= on a "YYYY-MM-DD" string field (both ends included). */
export function dayRangeFilter(field: string, from?: string, to?: string): Filter {
  const range: Record<string, string> = {};
  if (from && isDay(from)) range.$gte = from;
  if (to && isDay(to)) range.$lte = to;
  return Object.keys(range).length ? { [field]: range } : {};
}

/** Exact-match filter from a list param, only when the value is one of `allowed`. */
export function enumFilter(field: string, value: string | undefined, allowed: readonly string[]): Filter {
  return value && allowed.includes(value) ? { [field]: value } : {};
}

export function idFilter(field: string, value: string | undefined): Filter {
  return value && isValidObjectId(value) ? { [field]: new Types.ObjectId(value) } : {};
}

/** Export / report: every row matching the screen's filters. */
export const allRows = (query: ListQuery): ListQuery => ({ ...query, page: 1, limit: 100000 });

export const skipOf = (query: ListQuery) => (query.page - 1) * query.limit;
