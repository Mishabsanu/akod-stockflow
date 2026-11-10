import "server-only";
import { isValidObjectId, Types, type PipelineStage } from "mongoose";
import { STOCK_TXN_TYPES, type InventoryRow, type StockLevel, type StockTransaction } from "@/lib/commerceTypes";
import { fromPaise } from "@/lib/money";
import type { Paginated, SessionUser } from "@/lib/types";
import type { AdjustmentInput, StockInInput } from "@/lib/validation/stock.schema";
import { Product } from "../models/Product";
import { StockTransaction as StockTxnModel } from "../models/StockTransaction";
import { AppError, notFound } from "../http/errors";
import { escapeRegex, paginate, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";
import { moveStock } from "./stock.service";

export const INVENTORY_FILTERS = ["level", "category"];
export const TXN_FILTERS = ["type", "from", "to", "poNumber", "product"];

const LEVEL_SORTS: Record<string, Record<string, 1 | -1>> = {
  name: { name: 1 },
  sku: { sku: 1 },
  qty_asc: { quantity: 1, name: 1 },
  qty_desc: { quantity: -1, name: 1 },
  value: { stockValuePaise: -1 },
};

/**
 * Products joined with their central stock. Level: OUT (0), LOW (≤ reorder level), IN.
 * Inactive products are included only when the status filter asks for them.
 */
function inventoryPipeline(query: ListQuery): PipelineStage[] {
  // A product with variants holds no stock: its variants are listed instead
  const match: Filter = { hasVariants: { $ne: true } };
  if (query.status === "active" || query.status === "inactive") match.status = query.status;
  if (query.filters.category) match.category = query.filters.category;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    match.$or = [{ sku: rx }, { name: rx }, { barcode: rx }];
  }
  const levelMatch: Filter = {};
  const level = query.filters.level as StockLevel | undefined;
  if (level === "OUT_OF_STOCK") levelMatch.quantity = { $lte: 0 };
  if (level === "LOW_STOCK") levelMatch.$expr = { $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$reorderLevel"] }] };
  if (level === "IN_STOCK") levelMatch.$expr = { $gt: ["$quantity", "$reorderLevel"] };
  // "Low stock alerts" = low + out
  if (query.filters.level === "ALERT") levelMatch.$expr = { $lte: ["$quantity", "$reorderLevel"] };

  return [
    { $match: match },
    { $lookup: { from: "inventories", localField: "_id", foreignField: "product", as: "inv" } },
    {
      $addFields: {
        quantity: { $ifNull: [{ $first: "$inv.quantity" }, 0] },
        lastMovementAt: { $first: "$inv.lastMovementAt" },
      },
    },
    { $addFields: { stockValuePaise: { $multiply: ["$quantity", "$costPricePaise"] } } },
    { $match: levelMatch },
  ];
}

function levelOf(quantity: number, reorderLevel: number): StockLevel {
  if (quantity <= 0) return "OUT_OF_STOCK";
  return quantity <= reorderLevel ? "LOW_STOCK" : "IN_STOCK";
}

interface InvAgg {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  category?: string;
  status: "active" | "inactive";
  reorderLevel: number;
  costPricePaise: number;
  sellingPricePaise: number;
  quantity: number;
  stockValuePaise: number;
  lastMovementAt?: Date;
}

function toRow(r: InvAgg): InventoryRow {
  return toPlain<InventoryRow>({
    _id: r._id,
    product: {
      _id: r._id,
      name: r.name,
      sku: r.sku,
      category: r.category,
      status: r.status,
      reorderLevel: r.reorderLevel,
      costPrice: fromPaise(r.costPricePaise),
      sellingPrice: fromPaise(r.sellingPricePaise),
    },
    quantity: r.quantity,
    level: levelOf(r.quantity, r.reorderLevel),
    stockValue: fromPaise(r.stockValuePaise),
    lastMovementAt: r.lastMovementAt,
  });
}

export async function listInventory(query: ListQuery): Promise<Paginated<InventoryRow>> {
  const [res] = await Product.aggregate<{ items: InvAgg[]; total: { n: number }[] }>([
    ...inventoryPipeline(query),
    {
      $facet: {
        items: [
          { $sort: LEVEL_SORTS[query.sort] || (query.filters.level === "ALERT" ? LEVEL_SORTS.qty_asc : LEVEL_SORTS.name) },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        total: [{ $count: "n" }],
      },
    },
  ]);
  return paginate((res?.items ?? []).map(toRow), res?.total[0]?.n ?? 0, query);
}

/** All rows for export. */
export async function allInventory(query: ListQuery): Promise<InventoryRow[]> {
  const rows = await Product.aggregate<InvAgg>([...inventoryPipeline(query), { $sort: LEVEL_SORTS[query.sort] || LEVEL_SORTS.name }]);
  return rows.map(toRow);
}

export interface InventorySummary {
  products: number;
  units: number;
  value: number;
  low: number;
  out: number;
}

/** Header cards on the stock screens (active products only). */
export async function inventorySummary(): Promise<InventorySummary> {
  const [row] = await Product.aggregate<{ products: number; units: number; valuePaise: number; low: number; out: number }>([
    ...inventoryPipeline({ page: 1, limit: 1, search: "", status: "active", sort: "", filters: {} }),
    {
      $group: {
        _id: null,
        products: { $sum: 1 },
        units: { $sum: "$quantity" },
        valuePaise: { $sum: "$stockValuePaise" },
        low: { $sum: { $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$reorderLevel"] }] }, 1, 0] } },
        out: { $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] } },
      },
    },
  ]);
  return { products: row?.products ?? 0, units: row?.units ?? 0, value: fromPaise(row?.valuePaise ?? 0), low: row?.low ?? 0, out: row?.out ?? 0 };
}

async function loadProduct(id: string) {
  if (!isValidObjectId(id)) throw notFound("Product");
  const p = await Product.findById(id).select("sku name status hasVariants").lean();
  if (!p) throw notFound("Product");
  if (p.hasVariants) throw new AppError(`${p.sku} has variants — update the stock of each variant instead`, 409);
  return p;
}

export interface StockMoveResult {
  txnNo: string;
  sku: string;
  before: number;
  after: number;
}

/** Stock Update (manual): adds stock, PO number kept only as a reference. */
export async function stockIn(input: StockInInput, user: SessionUser, source: "manual" | "csv" = "manual"): Promise<StockMoveResult> {
  const p = await loadProduct(input.product);
  if (p.status !== "active") throw new AppError(`${p.sku} is inactive — activate it before adding stock`, 409);
  const txn = await moveStock({
    product: p._id,
    sku: p.sku,
    change: input.quantity,
    type: "STOCK_IN",
    txnDate: input.txnDate,
    poNumber: input.poNumber?.trim() ?? "",
    reason: input.reason ?? "",
    source,
    userId: user._id,
  });
  return { txnNo: txn.txnNo, sku: p.sku, before: txn.before, after: txn.after };
}

/** Stock Adjustment (+ / −) with a reason. Removing more than is on hand is refused. */
export async function adjustStock(input: AdjustmentInput, user: SessionUser): Promise<StockMoveResult> {
  const p = await loadProduct(input.product);
  const txn = await moveStock({
    product: p._id,
    sku: p.sku,
    change: input.direction === "in" ? input.quantity : -input.quantity,
    type: input.direction === "in" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    txnDate: input.txnDate,
    reason: input.reason,
    source: "manual",
    userId: user._id,
  });
  return { txnNo: txn.txnNo, sku: p.sku, before: txn.before, after: txn.after };
}

function txnFilter(query: ListQuery): Filter {
  const f: Filter = {};
  const { type, from, to, poNumber, product } = query.filters;
  if (type && (STOCK_TXN_TYPES as readonly string[]).includes(type)) f.type = type;
  if (from || to) f.txnDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (poNumber) f.poNumber = new RegExp(escapeRegex(poNumber), "i");
  if (product && isValidObjectId(product)) f.product = new Types.ObjectId(product);
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    f.$or = [{ sku: rx }, { txnNo: rx }, { reference: rx }, { poNumber: rx }];
  }
  return f;
}

const TXN_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  date: { txnDate: -1, createdAt: -1 },
};

export async function listStockTransactions(query: ListQuery): Promise<Paginated<StockTransaction>> {
  const filter = txnFilter(query);
  const [items, total] = await Promise.all([
    StockTxnModel.find(filter)
      .sort(TXN_SORTS[query.sort] || TXN_SORTS.newest)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("product", "name sku")
      .populate("createdBy", "name")
      .select("-__v")
      .lean(),
    StockTxnModel.countDocuments(filter),
  ]);
  return paginate(toPlain<StockTransaction[]>(items), total, query);
}

export async function allStockTransactions(query: ListQuery): Promise<StockTransaction[]> {
  const items = await StockTxnModel.find(txnFilter(query))
    .sort(TXN_SORTS[query.sort] || TXN_SORTS.newest)
    .limit(50000)
    .populate("product", "name sku")
    .populate("createdBy", "name")
    .select("-__v")
    .lean();
  return toPlain<StockTransaction[]>(items);
}

/** Latest movements of one product (product detail page). */
export async function recentTransactionsFor(productId: string, limit = 10): Promise<StockTransaction[]> {
  if (!isValidObjectId(productId)) return [];
  const items = await StockTxnModel.find({ product: productId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("product", "name sku")
    .populate("createdBy", "name")
    .select("-__v")
    .lean();
  return toPlain<StockTransaction[]>(items);
}
