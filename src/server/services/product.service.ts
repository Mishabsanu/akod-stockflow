import "server-only";
import { isValidObjectId } from "mongoose";
import { fromPaise, toPaise } from "@/lib/money";
import type { Paginated, Product } from "@/lib/types";
import type { ProductInput } from "@/lib/validation/product.schema";
import { ChannelProduct } from "../models/ChannelProduct";
import { Inventory } from "../models/Inventory";
import { Order } from "../models/Order";
import { Product as ProductModel, type ProductDoc } from "../models/Product";
import { StockTransaction } from "../models/StockTransaction";
import { AppError, notFound } from "../http/errors";
import { paginate, searchFilter, statusFilter, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";
import { stockFor } from "./stock.service";

const SEARCH_FIELDS = ["sku", "name", "barcode", "category"];
const PUBLIC_FIELDS = "-createdBy -__v";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  sku: { sku: 1 },
};

/** Product line for order forms and pickers: what can be sold, at what price, with how much stock. */
export interface SellableProduct {
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export function toProduct(doc: ProductDoc, stock?: number): Product {
  const { sellingPricePaise, costPricePaise, ...rest } = toPlain<
    Omit<Product, "sellingPrice" | "costPrice"> & { sellingPricePaise: number; costPricePaise: number }
  >(doc);
  return {
    ...rest,
    sellingPrice: fromPaise(sellingPricePaise),
    costPrice: fromPaise(costPricePaise),
    ...(stock !== undefined && { stock }),
  };
}

/** Form / import values (rupees) → stored shape (paise). */
export function toProductDoc(input: ProductInput) {
  const { sellingPrice, costPrice, ...rest } = input;
  return {
    ...rest,
    sku: input.sku.trim().toUpperCase(),
    sellingPricePaise: toPaise(sellingPrice),
    costPricePaise: toPaise(costPrice),
  };
}

export function productListFilter(query: ListQuery): Filter {
  const filter: Filter = { ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  if (query.filters.category) filter.category = query.filters.category;
  return filter;
}

export async function listProducts(query: ListQuery): Promise<Paginated<Product>> {
  const filter = productListFilter(query);
  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(SORTS[query.sort] || SORTS.newest)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select(PUBLIC_FIELDS)
      .lean<ProductDoc[]>(),
    ProductModel.countDocuments(filter),
  ]);
  const stock = await stockFor(items.map((p) => p._id));
  return paginate(
    items.map((p) => toProduct(p, stock.get(String(p._id)) ?? 0)),
    total,
    query
  );
}

export async function getProduct(id: string): Promise<Product> {
  if (!isValidObjectId(id)) throw notFound("Product");
  const doc = await ProductModel.findById(id).select(PUBLIC_FIELDS).lean<ProductDoc>();
  if (!doc) throw notFound("Product");
  const stock = await stockFor([doc._id]);
  return toProduct(doc, stock.get(String(doc._id)) ?? 0);
}

/** Creates the product and its central Inventory row (quantity 0). */
export async function createProduct(input: ProductInput, userId: string): Promise<Product> {
  const doc = await ProductModel.create({ ...toProductDoc(input), createdBy: userId });
  await Inventory.updateOne({ product: doc._id }, { $setOnInsert: { quantity: 0 } }, { upsert: true });
  return getProduct(String(doc._id));
}

/** Orders keep their own copy of SKU, name and price, so editing a product never changes past orders. */
export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  if (!isValidObjectId(id)) throw notFound("Product");
  const doc = await ProductModel.findByIdAndUpdate(id, toProductDoc(input), { returnDocument: "after", runValidators: true })
    .select(PUBLIC_FIELDS)
    .lean<ProductDoc>();
  if (!doc) throw notFound("Product");
  return getProduct(String(doc._id));
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Product");
  if ((await Order.exists({ "items.product": id })) || (await StockTransaction.exists({ product: id }))) {
    throw new AppError("This product has orders or stock history. Set it to inactive instead.", 409);
  }
  const deleted = await ProductModel.findByIdAndDelete(id);
  if (!deleted) throw notFound("Product");
  await Promise.all([ChannelProduct.deleteMany({ product: id }), Inventory.deleteOne({ product: id })]);
}

/**
 * Active products for local / distributor order forms and stock pickers.
 * `inStock` keeps only products with stock available.
 */
export async function listSellableProducts({ inStock = false, search = "" } = {}): Promise<SellableProduct[]> {
  const filter: Filter = { status: "active", ...searchFilter(search, ["sku", "name", "barcode"]) };
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

/** Distinct non-empty categories, for the list filter and the form's suggestions. */
export async function listCategories(): Promise<string[]> {
  const values = await ProductModel.distinct("category", { category: { $nin: ["", null] } });
  return (values as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
