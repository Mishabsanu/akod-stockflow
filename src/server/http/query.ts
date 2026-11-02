import "server-only";

export const PAGE_SIZES = [10, 20, 50, 100];

export interface ListQuery {
  page: number;
  limit: number;
  search: string;
  status: string;
  sort: string;
  /** Extra module-specific filters, e.g. { role: "...", stockStatus: "LOW_STOCK" } */
  filters: Record<string, string>;
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: RawParams, key: string): string {
  if (params instanceof URLSearchParams) return params.get(key) ?? "";
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Same parsing for API routes (URLSearchParams) and server pages (searchParams object). */
export function parseListQuery(params: RawParams, filterKeys: string[] = []): ListQuery {
  const page = Math.max(1, Number.parseInt(read(params, "page"), 10) || 1);
  const rawLimit = Number.parseInt(read(params, "limit"), 10);
  const limit = PAGE_SIZES.includes(rawLimit) ? rawLimit : 10;
  const filters: Record<string, string> = {};
  for (const key of filterKeys) {
    const value = read(params, key).trim();
    if (value) filters[key] = value;
  }
  return {
    page,
    limit,
    search: read(params, "search").trim().slice(0, 100),
    status: read(params, "status").trim(),
    sort: read(params, "sort").trim(),
    filters,
  };
}

/** Escapes user input before it is used inside a RegExp. */
export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Loosely typed Mongo filter built from user input (values are validated before use). */
export type Filter = Record<string, unknown>;

export function searchFilter(search: string, fields: string[]): Filter {
  if (!search) return {};
  const regex = new RegExp(escapeRegex(search), "i");
  return { $or: fields.map((f) => ({ [f]: regex })) };
}

export function paginate<T>(items: T[], total: number, query: Pick<ListQuery, "page" | "limit">) {
  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/** Only "active" / "inactive" are accepted; anything else means no status filter. */
export function statusFilter(status: string): Filter {
  return status === "active" || status === "inactive" ? { status } : {};
}

/** Extra list filters accepted by every order list (office, FOS, portal). */
export const ORDER_FILTERS = ["channel", "source", "orderDate", "beat", "fos"];
