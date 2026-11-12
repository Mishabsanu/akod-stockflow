import "server-only";
import type { Types } from "mongoose";
import { fromPaise } from "@/lib/money";
import { Category } from "../models/Category";
import { Inventory } from "../models/Inventory";
import { Order } from "../models/Order";
import { Product, type ProductDoc } from "../models/Product";

/**
 * Public, read-only catalog for the online store (akod-food).
 * Only active categories and active products marked "Show on storefront" are returned.
 * Prices are rupees. No cost price, stock counts or internal fields leave this service.
 */

export interface StorefrontCategory {
  slug: string;
  name: string;
  description: string;
  image: string | null;
  productCount: number;
}

export interface StorefrontVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  mrp: number;
  image: string | null;
  inStock: boolean;
}

export interface StorefrontProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string; // category slug
  categoryName: string;
  price: number; // lowest selling price (of its variants, if any)
  mrp: number;
  weight: string;
  description: string;
  summary: string;
  story: string;
  ingredients: string;
  shelfLife: string;
  flavorProfile: string;
  freeDelivery: boolean;
  images: string[];
  inStock: boolean;
  bestSeller: boolean;
  variants: StorefrontVariant[];
}

export interface StorefrontCatalog {
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
  /** Counts only: why products in AKOD ECO are not on the store (helps when the store looks empty). */
  hidden: { inactive: number; notOnStorefront: number; categoryInactive: number; noActiveVariants: number };
  generatedAt: string;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const BEST_SELLER_COUNT = 10;

type LeanProduct = ProductDoc & { _id: Types.ObjectId };

const weightOf = (p: Pick<ProductDoc, "size" | "unit" | "variantName">) =>
  p.size ? `${p.size} ${p.unit ?? ""}`.trim() : (p.variantName ?? "");

/** Units sold per top-level product (variants count toward their parent), ignoring cancelled / returned orders. */
async function unitsSold(): Promise<Map<string, number>> {
  const rows = await Order.aggregate<{ _id: Types.ObjectId; qty: number }>([
    { $match: { status: { $nin: ["CANCELLED", "RETURNED"] } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.qty]));
}

export async function getStorefrontCatalog(): Promise<StorefrontCatalog> {
  const [cats, parents, inactive, notOnStorefront] = await Promise.all([
    Category.find({ status: "active" }).sort({ name: 1 }).lean(),
    Product.find({ parent: null, status: "active", storefrontVisible: { $ne: false } })
      .select("-costPricePaise -createdBy -__v")
      .sort({ name: 1 })
      .lean<LeanProduct[]>(),
    Product.countDocuments({ parent: null, status: { $ne: "active" } }),
    Product.countDocuments({ parent: null, status: "active", storefrontVisible: false }),
  ]);

  const activeCats = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
  const visible = parents.filter((p) => !p.category || activeCats.has(p.category.toLowerCase()));

  const variantParents = visible.filter((p) => p.hasVariants).map((p) => p._id);
  const variants = variantParents.length
    ? await Product.find({ parent: { $in: variantParents }, status: "active" })
        .select("-costPricePaise -createdBy -__v")
        .sort({ sellingPricePaise: 1 })
        .lean<LeanProduct[]>()
    : [];

  const sellableIds = [...visible.filter((p) => !p.hasVariants).map((p) => p._id), ...variants.map((v) => v._id)];
  const [stockRows, sold] = await Promise.all([
    Inventory.find({ product: { $in: sellableIds } }).select("product quantity").lean(),
    unitsSold(),
  ]);
  const stock = new Map(stockRows.map((r) => [String(r.product), r.quantity]));

  const variantsByParent = new Map<string, LeanProduct[]>();
  for (const v of variants) {
    const key = String(v.parent);
    variantsByParent.set(key, [...(variantsByParent.get(key) ?? []), v]);
  }

  const catSlug = new Map(cats.map((c) => [c.name.toLowerCase(), slugify(c.name)]));
  const usedSlugs = new Set<string>();
  const soldByProduct = new Map<string, number>();

  const products: StorefrontProduct[] = [];
  let noActiveVariants = 0;
  for (const p of visible) {
    const id = String(p._id);
    const images = (p.images ?? []).map((i) => i.url).filter(Boolean);
    let vs: StorefrontVariant[] = [];
    let price = fromPaise(p.sellingPricePaise);
    let mrp = fromPaise(p.mrpPaise);
    let inStock = (stock.get(id) ?? 0) > 0;
    let units = sold.get(id) ?? 0;

    if (p.hasVariants) {
      const list = variantsByParent.get(id) ?? [];
      if (list.length === 0) {
        noActiveVariants++; // nothing to sell
        continue;
      }
      vs = list.map((v) => ({
        id: String(v._id),
        sku: v.sku,
        name: v.variantName || weightOf(v) || v.name,
        price: fromPaise(v.sellingPricePaise),
        mrp: fromPaise(v.mrpPaise),
        image: v.images?.[0]?.url ?? null,
        inStock: (stock.get(String(v._id)) ?? 0) > 0,
      }));
      const first = vs.find((v) => v.inStock) ?? vs[0];
      price = first.price;
      mrp = first.mrp;
      inStock = vs.some((v) => v.inStock);
      units = list.reduce((s, v) => s + (sold.get(String(v._id)) ?? 0), 0);
    }

    let slug = slugify(p.name);
    if (usedSlugs.has(slug)) slug = `${slug}-${slugify(p.sku)}`;
    usedSlugs.add(slug);
    soldByProduct.set(id, units);

    const catKey = (p.category ?? "").toLowerCase();
    products.push({
      id,
      slug,
      sku: p.sku,
      name: p.name,
      category: catSlug.get(catKey) ?? "",
      categoryName: activeCats.get(catKey)?.name ?? "",
      price,
      mrp: mrp > price ? mrp : price,
      weight: p.hasVariants ? (vs.find((v) => v.price === price)?.name ?? "") : weightOf(p),
      description: p.description ?? "",
      summary: p.summary ?? "",
      story: p.story ?? "",
      ingredients: p.ingredients ?? "",
      shelfLife: p.shelfLife ?? "",
      flavorProfile: p.flavorProfile ?? "",
      freeDelivery: Boolean(p.freeDelivery),
      images,
      inStock,
      bestSeller: false,
      variants: vs,
    });
  }

  // Best sellers: most units sold; fall back to the first products while there are no orders yet
  const ranked = [...products].sort((a, b) => (soldByProduct.get(b.id) ?? 0) - (soldByProduct.get(a.id) ?? 0));
  const top = ranked.filter((p) => (soldByProduct.get(p.id) ?? 0) > 0).slice(0, BEST_SELLER_COUNT);
  for (const p of top.length ? top : ranked.slice(0, BEST_SELLER_COUNT)) p.bestSeller = true;

  // Store order: Display Order 1, 2, 3… first, then products without one by name
  const orderOf = new Map(visible.map((p) => [String(p._id), p.displayOrder ?? 0]));
  const rank = (id: string) => orderOf.get(id) || Number.MAX_SAFE_INTEGER;
  products.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));

  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);

  return {
    categories: cats.map((c) => ({
      slug: slugify(c.name),
      name: c.name,
      description: c.description ?? "",
      image: c.image?.url ?? null,
      productCount: counts.get(slugify(c.name)) ?? 0,
    })),
    products,
    hidden: { inactive, notOnStorefront, categoryInactive: parents.length - visible.length, noActiveVariants },
    generatedAt: new Date().toISOString(),
  };
}
