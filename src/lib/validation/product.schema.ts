import * as Yup from "yup";
import { documentItem } from "../documents";
import { optionalObjectId, optionalText, requiredText, rupees, statusField, wholeNumber } from "./common";

export const SKU_PATTERN = /^[A-Za-z0-9\-_/.]+$/;
export const MAX_VARIANTS = 100;
export const MAX_PRODUCT_IMAGES = 12;

const skuField = () => requiredText("SKU code", 40).matches(SKU_PATTERN, "SKU may only contain letters, numbers and - _ / .");

/** One optional photo. `null` removes it; left out (CSV import) keeps the saved one. */
const imageField = () => documentItem.nullable().optional().default(undefined);

/** Maximum retail price printed on the pack (0 = not set). */
const mrpField = () => rupees("MRP");

/** Selling price may not be above the MRP when one is set. */
const sellingPriceField = () =>
  rupees("Selling price").test("max-mrp", "Selling price cannot be more than the MRP", function (v) {
    const mrp = Number(this.parent?.mrp) || 0;
    return !mrp || v === undefined || v <= mrp;
  });

/** A sellable version of a product (size, colour, pack …) with its own SKU, price, stock and photo. */
export const variantSchema = Yup.object({
  _id: optionalObjectId("Variant"),
  variantName: requiredText("Variant name", 80),
  sku: skuField(),
  barcode: optionalText("Barcode", 40),
  mrp: mrpField(),
  sellingPrice: sellingPriceField(),
  costPrice: rupees("Cost price"),
  reorderLevel: wholeNumber("Reorder level", 0).default(10),
  status: statusField,
  image: imageField(),
});

export type VariantInput = Yup.InferType<typeof variantSchema>;

export const productSchema = Yup.object({
  sku: skuField(),
  name: requiredText("Product name", 150),
  barcode: optionalText("Barcode", 40),
  category: optionalText("Category", 80),
  description: optionalText("Description", 1000),
  mrp: mrpField(),
  sellingPrice: sellingPriceField(),
  costPrice: rupees("Cost price"),
  reorderLevel: wholeNumber("Reorder level", 0).default(10),
  status: statusField,
  /** Delivered free of charge (variants follow their product) */
  freeDelivery: Yup.boolean().default(false),
  /** Photo gallery, first = cover. Left out (CSV import) = keep the saved photos. */
  images: Yup.array(documentItem).max(MAX_PRODUCT_IMAGES, `At most ${MAX_PRODUCT_IMAGES} photos`).default(undefined),
  /** Left out (CSV import) = keep the saved variants; [] removes them all. */
  variants: Yup.array(variantSchema).max(MAX_VARIANTS, `At most ${MAX_VARIANTS} variants`).default(undefined),
}).test("unique-skus", "", function (value) {
  const seen = new Map<string, string>([[String(value?.sku ?? "").trim().toUpperCase(), "the product"]]);
  const names = new Set<string>();
  for (const [i, v] of (value?.variants ?? []).entries()) {
    const sku = String(v?.sku ?? "").trim().toUpperCase();
    if (sku && seen.has(sku)) {
      return this.createError({ path: `variants[${i}].sku`, message: `SKU is already used by ${seen.get(sku)}` });
    }
    if (sku) seen.set(sku, `variant ${i + 1}`);
    const name = String(v?.variantName ?? "").trim().toLowerCase();
    if (name && names.has(name)) return this.createError({ path: `variants[${i}].variantName`, message: "Variant names must be different" });
    names.add(name);
  }
  return true;
});

export type ProductInput = Yup.InferType<typeof productSchema>;

export const emptyVariant: VariantInput = {
  _id: "",
  variantName: "",
  sku: "",
  barcode: "",
  mrp: 0,
  sellingPrice: 0,
  costPrice: 0,
  reorderLevel: 10,
  status: "active",
  image: null,
};

export const emptyProduct: ProductInput = {
  sku: "",
  name: "",
  barcode: "",
  category: "",
  description: "",
  mrp: 0,
  sellingPrice: 0,
  costPrice: 0,
  reorderLevel: 10,
  status: "active",
  freeDelivery: false,
  images: [],
  variants: [],
};
