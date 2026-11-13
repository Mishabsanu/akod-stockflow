import * as Yup from "yup";
import { documentItem } from "../documents";
import { optionalDay, optionalObjectId, optionalText, requiredText, rupees, statusField, wholeNumber } from "./common";

export const SKU_PATTERN = /^[A-Za-z0-9\-_/.]+$/;
export const MAX_VARIANTS = 100;
export const MAX_PRODUCT_IMAGES = 100;

const skuField = () => requiredText("SKU code", 40).matches(SKU_PATTERN, "SKU may only contain letters, numbers and - _ / .");

/** One optional photo. `null` removes it; left out (CSV import) keeps the saved one. */

/** Maximum retail price printed on the pack (0 = not set). */
const mrpField = () => rupees("MRP");

/** Selling price may not be above the MRP when one is set. */
const sellingPriceField = () =>
  rupees("Selling price").test("max-mrp", "Selling price cannot be more than the MRP", function (v) {
    const mrp = Number(this.parent?.mrp) || 0;
    return !mrp || v === undefined || v <= mrp;
  });

/** Units for a variant's packet weight / size. */
export const VARIANT_UNITS = ["g", "kg", "ml", "l", "pcs", "pack"] as const;
export const VARIANT_UNIT_LABELS: Record<(typeof VARIANT_UNITS)[number], string> = {
  g: "g (grams)",
  kg: "kg",
  ml: "ml",
  l: "L (litre)",
  pcs: "pcs",
  pack: "pack",
};

/** "250" + "g" → "250 g" (the variant's name). */
export const variantLabel = (size: string, unit: string) => `${String(size).trim()} ${unit === "l" ? "L" : unit}`.trim();

/**
 * A sellable version of a product (packet weight / size). The form asks for SKU (typed by the user),
 * size, unit, selling price, MRP and stock units; the name ("250 g") is derived on the server, and cost /
 * barcode / reorder level / status keep their saved values (or defaults for a new variant).
 */
export const variantSchema = Yup.object({
  _id: optionalObjectId("Variant"),
  sku: skuField(),
  size: requiredText("Packet weight / size", 20).matches(/^[0-9]+(\.[0-9]+)?$|^[A-Za-z0-9 .x/-]+$/, "Enter a size, e.g. 250"),
  unit: Yup.string().oneOf([...VARIANT_UNITS], "Choose a unit").required("Unit is required"),
  sellingPrice: sellingPriceField(),
  /** Stock on hand after saving; a change is posted as an opening stock / adjustment entry */
  stock: wholeNumber("Stock units", 0).max(10000000, "Stock units is too large"),
  /** Printed price; the storefront shows the saving against it (0 = not set) */
  mrp: mrpField(),
  // Not on the form — kept as saved (CSV / older variants)
  variantName: optionalText("Variant name", 80),
  barcode: optionalText("Barcode", 40),
  costPrice: rupees("Cost price"),
  reorderLevel: wholeNumber("Reorder level", 0).default(10),
  status: statusField,
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
  /** Storefront chips filter, e.g. Traditional, Spicy */
  flavorProfile: optionalText("Flavor profile", 60),
  /** One or two lines for listings (required on the product form) */
  summary: optionalText("Short summary", 300),
  story: optionalText("Detailed product story", 5000),
  ingredients: optionalText("Ingredients", 2000),
  shelfLife: optionalText("Shelf life", 60),
  mfgDate: optionalDay("Mfg date"),
  expiryDate: optionalDay("Expiry date").test("after-mfg", "Expiry date must be after the Mfg date", function (v) {
    const mfg = this.parent?.mfgDate as string | undefined;
    return !v || !mfg || v > mfg;
  }),
  /** Shown on the storefront */
  storefrontVisible: Yup.boolean().default(true),
  /** In the store's home banner (hero); when no product is ticked, the banner shows all */
  showInBanner: Yup.boolean().default(false),
  /** Storefront position: 1 shows first; 0 / empty = after the numbered products */
  displayOrder: Yup.number()
    .transform((v, orig) => (orig === "" || orig === null || Number.isNaN(v) ? 0 : v))
    .integer("Use a whole number")
    .min(0, "Use 1 or more (leave empty for no order)")
    .max(9999, "Use a number up to 9999")
    .default(0),
  /** Instagram reel / post links. Left out (CSV import) = keep the saved ones. */
  instagramReels: Yup.array(
    Yup.string()
      .trim()
      .required()
      .matches(/^https:\/\/(www\.)?instagram\.com\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/, "Enter an Instagram reel link, e.g. https://www.instagram.com/reel/…")
  )
    .max(10, "At most 10 reel links")
    .default(undefined),
  /** Delivered free of charge (variants follow their product) */
  freeDelivery: Yup.boolean().default(false),
  /** Photo gallery, first = cover. Left out (CSV import) = keep the saved photos. */
  images: Yup.array(documentItem).max(MAX_PRODUCT_IMAGES, `At most ${MAX_PRODUCT_IMAGES} photos`).default(undefined),
  /** Left out (CSV import) = keep the saved variants; [] removes them all. */
  variants: Yup.array(variantSchema).max(MAX_VARIANTS, `At most ${MAX_VARIANTS} variants`).default(undefined),
}).test("unique-variants", "", function (value) {
  const sizes = new Set<string>();
  const skus = new Map<string, string>([[String(value?.sku ?? "").trim().toUpperCase(), "the product"]]);
  for (const [i, v] of (value?.variants ?? []).entries()) {
    const sku = String(v?.sku ?? "").trim().toUpperCase();
    if (sku && skus.has(sku)) return this.createError({ path: `variants[${i}].sku`, message: `SKU is already used by ${skus.get(sku)}` });
    if (sku) skus.set(sku, `variant ${i + 1}`);
    const key = variantLabel(String(v?.size ?? ""), String(v?.unit ?? "")).toLowerCase();
    if (v?.size && sizes.has(key)) return this.createError({ path: `variants[${i}].size`, message: "This size is already added" });
    sizes.add(key);
  }
  return true;
});

/**
 * Product form / API: same as productSchema, plus Short summary required and at least one variant —
 * prices and stock live on the variants. (CSV import uses productSchema and may leave both out.)
 */
export const productFormSchema = productSchema.shape({
  summary: requiredText("Short summary", 300),
  variants: Yup.array(variantSchema)
    .min(1, "Add at least one variant — prices and stock are set per variant")
    .max(MAX_VARIANTS, `At most ${MAX_VARIANTS} variants`)
    .required("Add at least one variant"),
});

export type ProductInput = Yup.InferType<typeof productSchema>;

export const emptyVariant: VariantInput = {
  _id: "",
  size: "",
  unit: "g",
  sellingPrice: 0,
  stock: 0,
  variantName: "",
  sku: "",
  barcode: "",
  mrp: 0,
  costPrice: 0,
  reorderLevel: 10,
  status: "active",
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
  flavorProfile: "",
  summary: "",
  story: "",
  ingredients: "",
  shelfLife: "",
  mfgDate: "",
  expiryDate: "",
  storefrontVisible: true,
  displayOrder: 0,
  showInBanner: false,
  instagramReels: [],
  freeDelivery: false,
  images: [],
  variants: [],
};
