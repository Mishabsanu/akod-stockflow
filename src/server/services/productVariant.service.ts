import "server-only";
import type { Types } from "mongoose";
import { toPaise } from "@/lib/money";
import type { VariantInput } from "@/lib/validation/product.schema";
import { AppError } from "../http/errors";
import { ChannelProduct } from "../models/ChannelProduct";
import { Inventory } from "../models/Inventory";
import { Order } from "../models/Order";
import { Product as ProductModel, type ProductImageDoc } from "../models/Product";
import { StockTransaction } from "../models/StockTransaction";
import { stockFor } from "./stock.service";
import { destroyRemoved } from "./upload.service";

interface ParentInfo {
  _id: Types.ObjectId | string;
  name: string;
  category?: string;
  description?: string;
}

export const variantFullName = (parentName: string, variantName: string) => `${parentName} - ${variantName}`;

/** True when the product was ever ordered or moved in stock (it must be kept, only set inactive). */
export async function hasHistory(id: Types.ObjectId | string): Promise<boolean> {
  return Boolean((await Order.exists({ "items.product": id })) || (await StockTransaction.exists({ product: id })));
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
  const skus = variants.map((v) => v.sku.trim().toUpperCase());
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

/** Writes the variant list planned by planVariantSync. Variants share the parent's category and description. */
export async function applyVariantSync(
  parent: ParentInfo,
  variants: VariantInput[],
  plan: { removeIds: string[]; removedImages: ProductImageDoc[] },
  userId?: string
) {
  if (plan.removeIds.length) {
    await Promise.all([
      ProductModel.deleteMany({ _id: { $in: plan.removeIds } }),
      Inventory.deleteMany({ product: { $in: plan.removeIds } }),
      ChannelProduct.deleteMany({ product: { $in: plan.removeIds } }),
    ]);
    await destroyRemoved(plan.removedImages, []);
  }

  const before = new Map(
    (await ProductModel.find({ parent: parent._id }).select("_id images").lean()).map((v) => [String(v._id), v.images ?? []])
  );

  for (const v of variants) {
    const doc = {
      sku: v.sku.trim().toUpperCase(),
      variantName: v.variantName.trim(),
      name: variantFullName(parent.name, v.variantName.trim()),
      barcode: v.barcode ?? "",
      category: parent.category ?? "",
      description: parent.description ?? "",
      mrpPaise: toPaise(v.mrp),
      sellingPricePaise: toPaise(v.sellingPrice),
      costPricePaise: toPaise(v.costPrice),
      reorderLevel: v.reorderLevel,
      status: v.status,
      images: v.image ? [v.image] : [],
      parent: parent._id,
      hasVariants: false,
    };
    if (v._id) {
      await ProductModel.updateOne({ _id: v._id }, doc, { runValidators: true });
      const old = before.get(v._id);
      if (old?.length) await destroyRemoved(old, v.image ? [v.image] : []);
    } else {
      const created = await ProductModel.create({ ...doc, ...(userId && { createdBy: userId }) });
      await Inventory.updateOne({ product: created._id }, { $setOnInsert: { quantity: 0 } }, { upsert: true });
    }
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
      },
    },
  ]);
}
