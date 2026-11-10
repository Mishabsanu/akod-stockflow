import "server-only";
import { newDeleteBatch, softDelete } from "../models/softDelete";
import { isValidObjectId } from "mongoose";
import type { Category } from "@/lib/commerceTypes";
import type { Paginated } from "@/lib/types";
import type { CategoryInput } from "@/lib/validation/category.schema";
import { AppError, notFound } from "../http/errors";
import { paginate, searchFilter, statusFilter, type ListQuery } from "../http/query";
import { Category as CategoryModel, type CategoryDoc } from "../models/Category";
import { Product } from "../models/Product";
import { toPlain } from "../utils/serialize";
import { destroyRemoved } from "./upload.service";

const PUBLIC_FIELDS = "-createdBy -__v -nameKey";
const keyOf = (name: string) => name.trim().toLowerCase();

const SORTS: Record<string, Record<string, 1 | -1>> = {
  name: { name: 1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

/** Categories typed on products before the module existed become category records (runs once, when empty). */
async function backfillFromProducts() {
  if ((await CategoryModel.estimatedDocumentCount()) > 0) return;
  const names = ((await Product.distinct("category", { category: { $nin: ["", null] } })) as string[]).filter(Boolean);
  if (names.length) await ensureCategories(names);
}

/** Creates any of these categories that do not exist yet (product save, CSV import). */
export async function ensureCategories(names: string[], userId?: string) {
  const unique = [...new Map(names.map((n) => n.trim()).filter(Boolean).map((n) => [keyOf(n), n])).entries()];
  if (unique.length === 0) return;
  await CategoryModel.bulkWrite(
    unique.map(([nameKey, name]) => ({
      updateOne: {
        filter: { nameKey },
        update: { $setOnInsert: { name, nameKey, description: "", status: "active", ...(userId && { createdBy: userId }) } },
        upsert: true,
      },
    }))
  );
}

/** The saved spelling of a category name (so "chips" on a product becomes "Chips"). */
export async function canonicalCategory(name: string, userId?: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return "";
  await ensureCategories([trimmed], userId);
  const doc = await CategoryModel.findOne({ nameKey: keyOf(trimmed) }).select("name").lean();
  return doc?.name ?? trimmed;
}

async function productCounts(names: string[]): Promise<Map<string, number>> {
  const rows = await Product.aggregate<{ _id: string; n: number }>([
    { $match: { category: { $in: names }, parent: null } },
    { $group: { _id: "$category", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

export async function listCategoryPage(query: ListQuery): Promise<Paginated<Category>> {
  await backfillFromProducts();
  const filter = { ...searchFilter(query.search, ["name", "description"]), ...statusFilter(query.status) };
  const [items, total] = await Promise.all([
    CategoryModel.find(filter)
      .sort(SORTS[query.sort] || SORTS.name)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select(PUBLIC_FIELDS)
      .lean<CategoryDoc[]>(),
    CategoryModel.countDocuments(filter),
  ]);
  const counts = await productCounts(items.map((c) => c.name));
  return paginate(
    items.map((c) => ({ ...toPlain<Category>(c), productCount: counts.get(c.name) ?? 0 })),
    total,
    query
  );
}

export async function getCategory(id: string): Promise<Category> {
  if (!isValidObjectId(id)) throw notFound("Category");
  const doc = await CategoryModel.findById(id).select(PUBLIC_FIELDS).lean<CategoryDoc>();
  if (!doc) throw notFound("Category");
  const counts = await productCounts([doc.name]);
  return { ...toPlain<Category>(doc), productCount: counts.get(doc.name) ?? 0 };
}

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await CategoryModel.findOne({ nameKey: keyOf(name), ...(exceptId && { _id: { $ne: exceptId } }) })
    .select("_id")
    .lean();
  if (clash) {
    const message = "A category with this name already exists";
    throw new AppError(message, 409, { name: message });
  }
}

export async function createCategory(input: CategoryInput, userId: string): Promise<Category> {
  await assertNameFree(input.name);
  const doc = await CategoryModel.create({ ...input, name: input.name.trim(), nameKey: keyOf(input.name), createdBy: userId });
  return getCategory(String(doc._id));
}

/** Renaming a category renames it on every product and variant that uses it. */
export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  if (!isValidObjectId(id)) throw notFound("Category");
  const current = await CategoryModel.findById(id).select("name image").lean();
  if (!current) throw notFound("Category");
  await assertNameFree(input.name, id);
  const name = input.name.trim();
  await CategoryModel.updateOne({ _id: id }, { ...input, name, nameKey: keyOf(name) }, { runValidators: true });
  if (current.name !== name) await Product.updateMany({ category: current.name }, { category: name });
  if (current.image) await destroyRemoved([current.image], input.image ? [input.image] : []);
  return getCategory(id);
}

export async function deleteCategory(id: string, userId?: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Category");
  const doc = await CategoryModel.findById(id).select("name").lean();
  if (!doc) throw notFound("Category");
  const used = await Product.countDocuments({ category: doc.name, parent: null });
  if (used > 0) {
    throw new AppError(`${used} product(s) use "${doc.name}". Move them to another category or set this one to inactive.`, 409);
  }
  await softDelete(CategoryModel, { _id: id }, { batch: newDeleteBatch(), userId, primary: true });
}

/** All category names (list filters), active ones first in the form via `activeOnly`. */
export async function listCategoryNames({ activeOnly = false } = {}): Promise<string[]> {
  await backfillFromProducts();
  const docs = await CategoryModel.find(activeOnly ? { status: "active" } : {})
    .select("name")
    .sort({ name: 1 })
    .lean();
  return docs.map((d) => d.name);
}
