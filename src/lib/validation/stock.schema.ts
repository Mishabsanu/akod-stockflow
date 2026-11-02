import * as Yup from "yup";
import { todayIST } from "../indiaDate";
import { objectId, optionalText, requiredDay, requiredText } from "./common";

const qty = (label: string) =>
  Yup.number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .typeError(`${label} must be a number`)
    .required(`${label} is required`)
    .integer(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1`)
    .max(10000000, `${label} is too large`);

/** Stock Update (stock in): adds stock to the central inventory. PO number is only a reference. */
export const stockInSchema = Yup.object({
  product: objectId("Product"),
  quantity: qty("Quantity"),
  poNumber: optionalText("PO number", 60),
  txnDate: requiredDay("Transaction date"),
  reason: optionalText("Note", 300),
});

export type StockInInput = Yup.InferType<typeof stockInSchema>;

export const emptyStockIn = (): StockInInput => ({ product: "", quantity: "" as unknown as number, poNumber: "", txnDate: todayIST(), reason: "" });

/** Stock Adjustment: + (found, returned to shelf) or − (damaged, lost, count correction). Reason is required. */
export const adjustmentSchema = Yup.object({
  product: objectId("Product"),
  direction: Yup.string().oneOf(["in", "out"], "Choose add or remove").required("Choose add or remove"),
  quantity: qty("Quantity"),
  reason: requiredText("Reason", 300),
  txnDate: requiredDay("Date"),
});

export type AdjustmentInput = Yup.InferType<typeof adjustmentSchema>;

export const ADJUSTMENT_REASONS = ["Damaged", "Expired", "Lost / theft", "Physical count correction", "Sample / promotion", "Found in stock"];
