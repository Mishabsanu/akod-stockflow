import "server-only";
import type { Types } from "mongoose";
import type { StockTxnType } from "@/lib/commerceTypes";
import { nextCode } from "../models/Counter";
import { Inventory } from "../models/Inventory";
import { StockTransaction, type StockTransactionDoc } from "../models/StockTransaction";
import { AppError } from "../http/errors";

export interface StockMove {
  product: Types.ObjectId | string;
  sku: string;
  /** Signed change: + adds, − removes */
  change: number;
  type: StockTxnType;
  txnDate: string;
  poNumber?: string;
  reference?: string;
  order?: Types.ObjectId | string | null;
  reason?: string;
  source: "manual" | "csv" | "order";
  userId?: string;
}

/**
 * The only way stock changes. Atomic: a removal succeeds only if enough stock is on hand,
 * so central stock can never go negative even with many orders confirmed at once.
 * Writes the StockTransaction with the before / after quantities.
 */
export async function moveStock(move: StockMove): Promise<StockTransactionDoc> {
  if (!Number.isInteger(move.change) || move.change === 0) throw new AppError("Quantity must be a whole number other than 0", 422);
  const now = new Date();
  const inv =
    move.change > 0
      ? await Inventory.findOneAndUpdate(
          { product: move.product },
          { $inc: { quantity: move.change }, $set: { lastMovementAt: now } },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean()
      : await Inventory.findOneAndUpdate(
          { product: move.product, quantity: { $gte: -move.change } },
          { $inc: { quantity: move.change }, $set: { lastMovementAt: now } },
          { returnDocument: "after" }
        ).lean();

  if (!inv) {
    const current = (await Inventory.findOne({ product: move.product }).select("quantity").lean())?.quantity ?? 0;
    throw new AppError(`Not enough stock for ${move.sku}: ${current} available, ${-move.change} needed`, 409);
  }

  const after = inv.quantity;
  const txn = await StockTransaction.create({
    txnNo: await nextCode("stock_txn", "STK", 5),
    type: move.type,
    product: move.product,
    sku: move.sku,
    change: move.change,
    before: after - move.change,
    after,
    poNumber: move.poNumber ?? "",
    reference: move.reference ?? "",
    order: move.order ?? null,
    txnDate: move.txnDate,
    reason: move.reason ?? "",
    source: move.source,
    createdBy: move.userId,
  });
  return txn.toObject();
}

/** Available stock for each product id (missing = 0). */
export async function stockFor(productIds: (Types.ObjectId | string)[]): Promise<Map<string, number>> {
  const rows = await Inventory.find({ product: { $in: productIds } }).select("product quantity").lean();
  return new Map(rows.map((r) => [String(r.product), r.quantity]));
}
