import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import { fromPaise, toPaise } from "@/lib/money";
import type { Paginated, Product } from "@/lib/types";
import type { ProductInput } from "@/lib/validation/product.schema";
import { ChannelProduct } from "../models/ChannelProduct";
import { Inventory } from "../models/Inventory";
import { Product as ProductModel, type ProductDoc } from "../models/Product";
import { AppError, notFound } from "../http/errors";
import { paginate, searchFilter, statusFilter, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";
import { canonicalCategory, listCategoryNames } from "./category.service";
import { applyVariantSync, hasHistory, normalizeVariants, planVariantSync, refreshVariants, syncVariantStock } from "./productVariant.service";
import { stockFor } from "./stock.service";
import { activeCategoryFilter } from "./categoryStatus";
import { destroyRemoved } from "./upload.service";
import { newDeleteBatch, softDelete } from "../models/softDelete";

const SEARCH_FIELDS = ["sku", "name", "barcode", "category", "variantName", "flavorProfile"];
const PUBLIC_FIELDS = "-createdBy -__v";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  sku: { sku: 1 },
};

/** Not sold or stocked directly: its variants are. */
export const SELLABLE_FILTER: Filter = { hasVariants: { $ne: true } };

/** Product line for order forms and pickers: what can be sold, at what price, with how much stock. */
export interface SellableProduct {
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export function toProduct(doc: ProductDoc, stock?: number): Product {
  const { mrpPaise, sellingPricePaise, costPricePaise, ...rest } = toPlain<
    Omit<Product, "mrp" | "sellingPrice" | "costPrice"> & { mrpPaise?: number; sellingPricePaise: number; costPricePaise: number }
  >(doc);
  return {
    ...rest,
    mrp: fromPaise(mrpPaise ?? 0),
    sellingPrice: fromPaise(sellingPricePaise),
    costPrice: fromPaise(costPricePaise),
    ...(stock !== undefined && { stock }),
  };
}

/** Form / import values (rupees) → stored shape (paise). Variants are saved separately. */
export function toProductDoc(input: ProductInput) {
  const { mrp, sellingPrice, costPrice, variants, images, ...rest } = input;
  void variants;
  // Fields left out (CSV import: reels, photos) keep their saved value
  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as typeof rest;
  return {
    ...defined,
    ...(images !== undefined && { images }),
    sku: input.sku.trim().toUpperCase(),
    mrpPaise: toPaise(mrp),
    sellingPricePaise: toPaise(sellingPrice),
    costPricePaise: toPaise(costPrice),
  };
}

/** Top-level products; a search also finds a product through its variants' SKU / name / barcode. */
export async function productListFilter(query: ListQuery): Promise<Filter> {
  const filter: Filter = { parent: null, ...statusFilter(query.status) };
  if (query.filters.category) filter.category = query.filters.category;
  if (query.filters.flavor) filter.flavorProfile = query.filters.flavor;
  if (query.filters.freeDelivery === "yes") filter.freeDelivery = true;
  if (query.filters.freeDelivery === "no") filter.freeDelivery = { $ne: true };
  const search = searchFilter(query.search, SEARCH_FIELDS);
  if (search.$or) {
    const viaVariant = await ProductModel.find({ parent: { $ne: null }, ...search }).distinct("parent");
    filter.$or = [...(search.$or as Filter[]), ...(viaVariant.length ? [{ _id: { $in: viaVariant } }] : [])];
  }
  return filter;
}

/** Variants of these products (oldest first), with stock. */
async function variantsOf(parentIds: Types.ObjectId[]): Promise<Map<string, Product[]>> {
  const out = new Map<string, Product[]>();
  if (parentIds.length === 0) return out;
  const docs = await ProductModel.find({ parent: { $in: parentIds } })
    .sort({ createdAt: 1, _id: 1 })
    .select(PUBLIC_FIELDS)
    .lean<ProductDoc[]>();
  const stock = await stockFor(docs.map((d) => d._id));
  for (const d of docs) {
    const key = String(d.parent);
    out.set(key, [...(out.get(key) ?? []), toProduct(d, stock.get(String(d._id)) ?? 0)]);
  }
  return out;
}

/** Attaches variants; a product with variants shows their total stock. */
async function withVariants(docs: ProductDoc[]): Promise<Product[]> {
  const [stock, variants] = await Promise.all([
    stockFor(docs.map((p) => p._id)),
    variantsOf(docs.filter((p) => p.hasVariants).map((p) => p._id)),
  ]);
  return docs.map((p) => {
    const list = variants.get(String(p._id));
    if (!list?.length) return toProduct(p, stock.get(String(p._id)) ?? 0);
    return { ...toProduct(p, list.reduce((n, v) => n + (v.stock ?? 0), 0)), variants: list };
  });
}

export async function listProducts(query: ListQuery): Promise<Paginated<Product>> {
  const filter = await productListFilter(query);
  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(SORTS[query.sort] || SORTS.newest)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select(PUBLIC_FIELDS)
      .lean<ProductDoc[]>(),
    ProductModel.countDocuments(filter),
  ]);
  return paginate(await withVariants(items), total, query);
}

export async function getProduct(id: string): Promise<Product> {
  if (!isValidObjectId(id)) throw notFound("Product");
  const doc = await ProductModel.findById(id).select(PUBLIC_FIELDS).lean<ProductDoc>();
  if (!doc) throw notFound("Product");
  const [product] = await withVariants([doc]);
  if (doc.parent) {
    const parent = await ProductModel.findById(doc.parent).select("name").lean();
    product.parentName = parent?.name;
  }
  return product;
}

/** Creates the product, its variants and their central Inventory rows (quantity 0). */
export async function createProduct(input: ProductInput, userId: string): Promise<Product> {
  const variants = normalizeVariants(input.variants ?? []);
  const plan = await planVariantSync(null, variants);
  const category = await canonicalCategory(input.category ?? "", userId);
  const doc = await ProductModel.create({ ...toProductDoc({ ...input, category }), hasVariants: variants.length > 0, createdBy: userId });
  await Inventory.updateOne({ product: doc._id }, { $setOnInsert: { quantity: 0 } }, { upsert: true });
  const ids = await applyVariantSync(doc, variants, plan, userId);
  await syncVariantStock(ids, variants, userId);
  return getProduct(String(doc._id));
}

/**
 * Orders keep their own copy of SKU, name and price, so editing a product never changes past orders.
 * A variant (CSV import by its SKU) only takes its own fields; name and category come from its parent.
 */
export async function updateProduct(id: string, input: ProductInput, userId?: string): Promise<Product> {
  if (!isValidObjectId(id)) throw notFound("Product");
  const current = await ProductModel.findById(id).select("parent images hasVariants").lean();
  if (!current) throw notFound("Product");
  const fields = toProductDoc(input);

  if (current.parent) {
    const { sku, barcode, mrpPaise, sellingPricePaise, costPricePaise, reorderLevel, status } = fields;
    await ProductModel.updateOne(
      { _id: id },
      { sku, barcode, mrpPaise, sellingPricePaise, costPricePaise, reorderLevel, status, ...(fields.images && { images: fields.images.slice(0, 1) }) },
      { runValidators: true }
    );
  } else {
    const variants = input.variants ? normalizeVariants(input.variants) : null;
    const plan = variants ? await planVariantSync(id, variants) : null;
    const category = await canonicalCategory(input.category ?? "");
    const doc = await ProductModel.findByIdAndUpdate(
      id,
      { ...fields, category, ...(variants && { hasVariants: variants.length > 0 }) },
      { returnDocument: "after", runValidators: true }
    ).lean<ProductDoc>();
    if (!doc) throw notFound("Product");
    if (plan && variants) {
      const ids = await applyVariantSync(doc, variants, plan, userId);
      await syncVariantStock(ids, variants, userId);
    }
    else if (doc.hasVariants) await refreshVariants(doc);
  }

  if (fields.images) await destroyRemoved(current.images ?? [], fields.images);
  return getProduct(id);
}

/** Deletes a product with its variants, or one variant; anything with orders or stock history is kept. */
/** Moves a product (with its variants) to the Recycle Bin; anything with orders or stock history is kept live. */
export async function deleteProduct(id: string, userId?: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Product");
  const doc = await ProductModel.findById(id).select("parent images").lean();
  if (!doc) throw notFound("Product");
  const variants = await ProductModel.find({ parent: id }).select("_id images").lean();
  const all = [doc, ...variants];
  for (const p of all) {
    if (await hasHistory(p._id)) {
      throw new AppError(
        p === doc
          ? "This product has orders or stock history. Set it to inactive instead."
          : "A variant of this product has orders or stock history. Set the product to inactive instead.",
        409
      );
    }
  }
  const ids = all.map((p) => p._id);
  // One batch: restoring the product restores its variants. Photos and the (empty) stock row are kept for restore;
  // marketplace listings are removed and must be assigned again after a restore.
  const batch = newDeleteBatch();
  await softDelete(ProductModel, { parent: id }, { batch, userId });
  await softDelete(ProductModel, { _id: id }, { batch, userId, primary: true });
  await ChannelProduct.deleteMany({ product: { $in: ids } });
  if (doc.parent && !(await ProductModel.exists({ parent: doc.parent }))) {
    await ProductModel.updateOne({ _id: doc.parent }, { hasVariants: false });
  }
}

/**
 * Active products for local / distributor order forms and stock pickers (variants, never their parent).
 * `inStock` keeps only products with stock available.
 */
export async function listSellableProducts({ inStock = false, search = "" } = {}): Promise<SellableProduct[]> {
  const filter: Filter = { status: "active", ...SELLABLE_FILTER, ...(await activeCategoryFilter()), ...searchFilter(search, ["sku", "name", "barcode"]) };
  const docs = await ProductModel.find(filter).sort({ name: 1 }).select("sku name sellingPricePaise").limit(5000).lean();
  const stock = await stockFor(docs.map((d) => d._id));
  return docs
    .map((d) => ({
      productId: String(d._id),
      sku: d.sku,
      name: d.name,
      price: fromPaise(d.sellingPricePaise),
      stock: stock.get(String(d._id)) ?? 0,
    }))
    .filter((p) => !inStock || p.stock > 0);
}

/** Flavor profiles in use (list filter, form suggestions). */
export async function listFlavorProfiles(): Promise<string[]> {
  const values = (await ProductModel.distinct("flavorProfile", { parent: null, flavorProfile: { $nin: ["", null] } })) as string[];
  return values.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Category names for list filters (all) and the product form (`activeOnly`). */
export async function listCategories(opts?: { activeOnly?: boolean }): Promise<string[]> {
  return listCategoryNames(opts);
}
