import "server-only";
import type { Types } from "mongoose";
import { toPaise } from "@/lib/money";
import { todayIST } from "@/lib/indiaDate";
import { variantLabel, type VariantInput } from "@/lib/validation/product.schema";
import { AppError } from "../http/errors";
import { ChannelProduct } from "../models/ChannelProduct";
import { Inventory } from "../models/Inventory";
import { Order } from "../models/Order";
import { Product as ProductModel, type ProductImageDoc } from "../models/Product";
import { StockTransaction } from "../models/StockTransaction";
import { moveStock, stockFor } from "./stock.service";
import { newDeleteBatch, softDelete } from "../models/softDelete";

interface ParentInfo {
  _id: Types.ObjectId | string;
  name: string;
  freeDelivery?: boolean;
  category?: string;
  description?: string;
}

export const variantFullName = (parentName: string, variantName: string) => `${parentName} - ${variantName}`;

/** True when the product was ever ordered or moved in stock (it must be kept, only set inactive). */
export async function hasHistory(id: Types.ObjectId | string): Promise<boolean> {
  return Boolean((await Order.exists({ "items.product": id })) || (await StockTransaction.exists({ product: id })));
}

/** Variant name from size + unit ("250 g"); the SKU is the one the user typed. */
export function normalizeVariants(variants: VariantInput[]): VariantInput[] {
  return variants.map((v) => ({ ...v, variantName: variantLabel(v.size, v.unit), sku: v.sku.trim().toUpperCase() }));
}

function fieldError(message: string, path: string, status = 409) {
  return new AppError(message, status, { [path]: message });
}

/**
 * Checks a variant list before anything is written: SKUs free, ids belong to this product,
 * removed variants have no history, and a product does not switch to variants while holding stock.
 * Returns the ids of variants to delete.
 */
export async function planVariantSync(
  parentId: Types.ObjectId | string | null,
  variants: VariantInput[]
): Promise<{ removeIds: string[]; removedImages: ProductImageDoc[] }> {
  const existing = parentId ? await ProductModel.find({ parent: parentId }).select("_id sku images").lean() : [];
  const existingIds = new Set(existing.map((v) => String(v._id)));

  for (const [i, v] of variants.entries()) {
    if (v._id && !existingIds.has(v._id)) throw fieldError("This variant no longer exists. Reload the page.", `variants[${i}].variantName`, 422);
  }

  const ownIds = [...(parentId ? [parentId] : []), ...existing.map((v) => v._id)];
  const skus = variants.map((v) => (v.sku ?? "").trim().toUpperCase());
  const taken = await ProductModel.find({ sku: { $in: skus }, _id: { $nin: ownIds } }).select("sku").lean();
  if (taken.length) {
    const i = skus.indexOf(taken[0].sku);
    throw fieldError(`SKU ${taken[0].sku} is already used by another product`, `variants[${i}].sku`);
  }

  const keep = new Set(variants.map((v) => v._id).filter(Boolean));
  const removed = existing.filter((v) => !keep.has(String(v._id)));
  for (const v of removed) {
    if (await hasHistory(v._id)) {
      throw new AppError(`Variant ${v.sku} has orders or stock history. Set it to inactive instead of removing it.`, 409);
    }
  }

  if (parentId && existing.length === 0 && variants.length > 0) {
    const stock = (await stockFor([parentId])).get(String(parentId)) ?? 0;
    if (stock > 0) {
      throw new AppError(
        `This product has ${stock} in stock. Stock is kept per variant, so adjust this product's stock to 0 before adding variants.`,
        409
      );
    }
  }

  return {
    removeIds: removed.map((v) => String(v._id)),
    removedImages: removed.flatMap((v) => v.images ?? []),
  };
}

/**
 * Writes the variant list planned by planVariantSync (call normalizeVariants first). Variants share the
 * parent's category, description and free delivery. Photos are not kept per variant.
 * Returns each variant's id, in the same order as `variants`.
 */
export async function applyVariantSync(
  parent: ParentInfo,
  variants: VariantInput[],
  plan: { removeIds: string[]; removedImages: ProductImageDoc[] },
  userId?: string
): Promise<string[]> {
  // Variants removed on the form go to the Recycle Bin one by one (stock row kept for restore)
  for (const removeId of plan.removeIds) {
    await softDelete(ProductModel, { _id: removeId }, { batch: newDeleteBatch(), userId, primary: true });
  }
  if (plan.removeIds.length) await ChannelProduct.deleteMany({ product: { $in: plan.removeIds } });

  const ids: string[] = [];
  for (const v of variants) {
    const name = (v.variantName ?? "").trim();
    const doc = {
      sku: (v.sku ?? "").trim().toUpperCase(),
      variantName: name,
      size: v.size.trim(),
      unit: v.unit,
      name: variantFullName(parent.name, name),
      barcode: v.barcode ?? "",
      category: parent.category ?? "",
      description: parent.description ?? "",
      mrpPaise: toPaise(v.mrp),
      sellingPricePaise: toPaise(v.sellingPrice),
      costPricePaise: toPaise(v.costPrice),
      reorderLevel: v.reorderLevel,
      status: v.status,
      parent: parent._id,
      hasVariants: false,
      freeDelivery: Boolean(parent.freeDelivery),
    };
    if (v._id) {
      await ProductModel.updateOne({ _id: v._id }, doc, { runValidators: true });
      ids.push(v._id);
    } else {
      const created = await ProductModel.create({ ...doc, images: [], ...(userId && { createdBy: userId }) });
      await Inventory.updateOne({ product: created._id }, { $setOnInsert: { quantity: 0 } }, { upsert: true });
      ids.push(String(created._id));
    }
  }
  return ids;
}

/**
 * "Stock units" on the product form: brings each variant to that quantity through the stock log
 * (opening stock for a new variant, adjustment in / out for an existing one). Nothing is posted when unchanged.
 */
export async function syncVariantStock(ids: string[], variants: VariantInput[], userId?: string) {
  const current = await stockFor(ids);
  for (const [i, id] of ids.entries()) {
    const v = variants[i];
    const target = Number(v.stock ?? 0);
    const now = current.get(id) ?? 0;
    const change = target - now;
    if (!change) continue;
    const isNew = !v._id;
    await moveStock({
      product: id,
      sku: (v.sku ?? "").toUpperCase(),
      change,
      type: change > 0 ? (isNew ? "STOCK_IN" : "ADJUSTMENT_IN") : "ADJUSTMENT_OUT",
      txnDate: todayIST(),
      reason: isNew ? "Opening stock (product form)" : "Stock units changed on the product form",
      source: "manual",
      userId,
    });
  }
}

/** After the parent's name / category / description changed (e.g. CSV import), copy them to its variants. */
export async function refreshVariants(parent: ParentInfo) {
  await ProductModel.updateMany({ parent: parent._id }, [
    {
      $set: {
        name: { $concat: [parent.name, " - ", "$variantName"] },
        category: parent.category ?? "",
        description: parent.description ?? "",
        freeDelivery: Boolean(parent.freeDelivery),
      },
    },
  ]);
}
