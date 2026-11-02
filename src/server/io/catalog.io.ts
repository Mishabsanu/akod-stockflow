import "server-only";
import { ValidationError } from "yup";
import type { Product } from "@/lib/types";
import { productSchema, type ProductInput } from "@/lib/validation/product.schema";
import { AppError } from "../http/errors";
import { parseListQuery } from "../http/query";
import { Product as ProductModel, type ProductDoc } from "../models/Product";
import { createProduct, listProducts, toProduct, updateProduct } from "../services/product.service";
import type { IoEntity } from "./types";

const ALL = { page: 1, limit: 10000 };

const firstError = (e: unknown) => (e instanceof ValidationError ? e.errors[0] : e instanceof Error ? e.message : "Invalid row");

function toInput(p: Product): ProductInput {
  return {
    sku: p.sku,
    name: p.name,
    barcode: p.barcode || "",
    category: p.category || "",
    description: p.description || "",
    sellingPrice: p.sellingPrice,
    costPrice: p.costPrice,
    reorderLevel: p.reorderLevel,
    status: p.status,
  };
}

/** "Active" / "inactive" / "yes" / "no" … → status. */
function readStatus(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const v = String(value).trim().toLowerCase();
  if (["active", "yes", "y", "1", "true"].includes(v)) return "active";
  if (["inactive", "no", "n", "0", "false"].includes(v)) return "inactive";
  return v;
}

/** Products: rows matched by SKU — existing SKUs are updated (blank cells keep their value), new SKUs are created. */
export const productsIo: IoEntity<Product> = {
  title: "Products",
  module: "product",
  fileName: "Products",
  requiredField: "sku",
  rows: (params) => listProducts({ ...parseListQuery(params, ["category"]), ...ALL }).then((p) => p.items),
  columns: [
    { header: "SKU Code", field: "sku", value: (p) => p.sku, width: 22, aliases: ["sku", "skucode", "sku_code"] },
    { header: "Product Name", field: "name", value: (p) => p.name, width: 36, aliases: ["name", "product"] },
    { header: "Barcode", field: "barcode", value: (p) => p.barcode || "", width: 16, aliases: ["ean"] },
    { header: "Category", field: "category", value: (p) => p.category || "", width: 18 },
    { header: "Description", field: "description", value: (p) => p.description || "", width: 40 },
    { header: "Selling Price", field: "sellingPrice", value: (p) => p.sellingPrice, numeric: true, width: 14, aliases: ["price", "sp", "mrp"] },
    { header: "Cost Price", field: "costPrice", value: (p) => p.costPrice, numeric: true, width: 14, aliases: ["cost", "cp"] },
    { header: "Reorder Level", field: "reorderLevel", value: (p) => p.reorderLevel, numeric: true, width: 14, aliases: ["lowstock", "minstock"] },
    { header: "Status", field: "status", value: (p) => p.status, width: 10 },
    { header: "Stock", value: (p) => p.stock ?? 0, width: 10 },
  ],
  async importRow(record, user, ctx) {
    const sku = String(record.sku ?? "").trim().toUpperCase();
    if (!sku) throw new AppError("SKU Code is required");
    const doc = await ProductModel.findOne({ sku }).select("-__v -createdBy").lean<ProductDoc>();
    const existing = doc ? toProduct(doc) : null;
    // Same SKU twice in one file: the second row is an update
    const seen = ctx.scratch.has(sku);
    ctx.scratch.set(sku, true);

    let input: ProductInput;
    try {
      const base = existing ? toInput(existing) : { status: "active" };
      input = await productSchema.validate(
        { ...base, ...record, sku, status: readStatus(record.status) ?? base.status },
        { stripUnknown: true }
      );
    } catch (e) {
      throw new AppError(firstError(e));
    }

    const outcome = existing || seen ? "updated" : "created";
    if (!existing && !input.name) throw new AppError("Product Name is required for a new SKU");
    if (ctx.dryRun) {
      const changes = existing
        ? (Object.keys(input) as (keyof ProductInput)[]).filter((k) => String(input[k]) !== String(toInput(existing)[k]))
        : [];
      return {
        outcome,
        label: sku,
        detail: existing ? (changes.length ? `Changes: ${changes.join(", ")}` : "No changes") : `New product: ${input.name}`,
      };
    }
    if (existing) await updateProduct(existing._id, input);
    else {
      const again = await ProductModel.findOne({ sku }).select("_id").lean();
      if (again) await updateProduct(String(again._id), input);
      else await createProduct(input, user._id);
    }
    return { outcome, label: sku, detail: input.name };
  },
};
