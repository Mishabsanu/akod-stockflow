import * as Yup from "yup";
import { optionalText, requiredText, rupees, statusField } from "./common";

export const channelSchema = Yup.object({
  name: requiredText("Channel name", 80),
  code: requiredText("Channel code", 20).matches(/^[A-Za-z0-9\-_]+$/, "Code may only contain letters, numbers, - and _"),
  description: optionalText("Description", 500),
  status: statusField,
});

export type ChannelInput = Yup.InferType<typeof channelSchema>;

export const emptyChannel: ChannelInput = { name: "", code: "", description: "", status: "active" };

export const channelStatusSchema = Yup.object({ status: statusField.required() });

const ids = Yup.array(Yup.string().required().matches(/^[a-f0-9]{24}$/i, "Invalid product"))
  .min(1, "Select at least one product")
  .max(1000, "Select at most 1000 products at a time")
  .required()
  .default([]);

/** Optional assigned qty: blank = no limit. */
export const allocatedQtyField = Yup.number()
  .transform((v, o) => (o === "" || o === null || o === undefined ? null : v))
  .nullable()
  .typeError("Assigned qty must be a number")
  .integer("Assigned qty must be a whole number")
  .min(0, "Assigned qty cannot be negative")
  .max(10000000, "Assigned qty is too large")
  .default(null);

export const assignProductsSchema = Yup.object({
  productIds: ids,
  /** Assigned qty per product id (missing = no limit) */
  allocations: Yup.array(
    Yup.object({ product: Yup.string().required().matches(/^[a-f0-9]{24}$/i, "Invalid product"), allocatedQty: allocatedQtyField })
  ).default([]),
});

export const removeChannelProductsSchema = Yup.object({
  ids: Yup.array(Yup.string().required().matches(/^[a-f0-9]{24}$/i, "Invalid id")).min(1, "Select at least one product").required().default([]),
});

/** Listing details on one marketplace: its own SKU (ASIN / FSN …) and price (0 = product selling price). */
export const channelProductSchema = Yup.object({
  channelSku: optionalText("Marketplace SKU", 60),
  channelPrice: rupees("Marketplace price"),
  allocatedQty: allocatedQtyField,
});

export type ChannelProductInput = Yup.InferType<typeof channelProductSchema>;
