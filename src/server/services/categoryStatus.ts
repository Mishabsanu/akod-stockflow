import "server-only";
import { Category } from "../models/Category";

/**
 * Products in an inactive category cannot be sold: they are hidden on the online store, left out of
 * order and channel pickers, and orders containing them cannot be created or confirmed.
 * (Variants carry their parent's category, so one check covers both.)
 */
export async function inactiveCategoryNames(): Promise<string[]> {
  return Category.find({ status: "inactive" }).distinct("name");
}

/** Mongo filter part: product's category is not an inactive one. */
export async function activeCategoryFilter(): Promise<Record<string, unknown>> {
  const names = await inactiveCategoryNames();
  return names.length ? { category: { $nin: names } } : {};
}
