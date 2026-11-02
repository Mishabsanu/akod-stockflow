import * as Yup from "yup";
import { optionalText, requiredText, rupees, statusField, wholeNumber } from "./common";

export const SKU_PATTERN = /^[A-Za-z0-9\-_/.]+$/;

export const productSchema = Yup.object({
  sku: requiredText("SKU code", 40).matches(SKU_PATTERN, "SKU may only contain letters, numbers and - _ / ."),
  name: requiredText("Product name", 150),
  barcode: optionalText("Barcode", 40),
  category: optionalText("Category", 80),
  description: optionalText("Description", 1000),
  sellingPrice: rupees("Selling price"),
  costPrice: rupees("Cost price"),
  reorderLevel: wholeNumber("Reorder level", 0).default(10),
  status: statusField,
});

export type ProductInput = Yup.InferType<typeof productSchema>;

export const emptyProduct: ProductInput = {
  sku: "",
  name: "",
  barcode: "",
  category: "",
  description: "",
  sellingPrice: 0,
  costPrice: 0,
  reorderLevel: 10,
  status: "active",
};
