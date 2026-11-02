import * as Yup from "yup";
import { ORDER_STATUSES, ORDER_TYPES } from "../commerceTypes";
import { PAYMENT_METHODS } from "../financeTypes";
import { optionalDay, optionalObjectId, optionalPhone, optionalText, positiveRupees, requiredDay, rupees } from "./common";

const itemSchema = Yup.object({
  product: Yup.string()
    .required("Select a product")
    .matches(/^[a-f0-9]{24}$/i, "Select a product"),
  quantity: Yup.number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .typeError("Qty must be a number")
    .required("Qty is required")
    .integer("Qty must be a whole number")
    .min(1, "Qty must be at least 1")
    .max(1000000, "Qty is too large"),
  price: rupees("Price").max(10000000, "Price is too large"),
});

export const orderSchema = Yup.object({
  orderType: Yup.string().oneOf(ORDER_TYPES, "Choose the order type").required("Choose the order type"),
  channel: optionalObjectId("Marketplace").when("orderType", {
    is: "MARKETPLACE",
    then: (s) => s.required("Select the marketplace"),
  }),
  orderReference: optionalText("Order reference", 100),
  customer: optionalObjectId("Distributor").when("orderType", {
    is: "DISTRIBUTOR",
    then: (s) => s.required("Select the distributor"),
  }),
  customerName: optionalText("Customer name", 150),
  customerPhone: optionalPhone("Phone"),
  customerAddress: optionalText("Address", 500),
  orderDate: requiredDay("Order date"),
  dueDate: optionalDay("Due date"),
  items: Yup.array(itemSchema).min(1, "Add at least one product").max(200, "At most 200 lines per order").required(),
  discount: rupees("Discount"),
  shipping: rupees("Shipping charge").max(10000000, "Shipping charge is too large"),
  taxPercent: Yup.number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .typeError("Tax % must be a number")
    .min(0, "Tax % cannot be negative")
    .max(100, "Tax % must be at most 100")
    .default(0),
  upfrontPayment: rupees("Amount paid"),
  upfrontPaymentMethod: Yup.string()
    .oneOf(["", ...PAYMENT_METHODS], "Choose a payment method")
    .default("")
    .when("upfrontPayment", {
      is: (v: number) => Number(v) > 0,
      then: (s) => s.required("Choose how it was paid").notOneOf([""], "Choose how it was paid"),
    }),
  upfrontPaymentRef: optionalText("Payment reference", 100),
  notes: optionalText("Notes", 1000),
  /** "Save & Confirm": confirm right after saving */
  confirm: Yup.boolean().default(false),
});

export type OrderInput = Yup.InferType<typeof orderSchema>;
export type OrderItemInput = Yup.InferType<typeof itemSchema>;

export const statusChangeSchema = Yup.object({
  status: Yup.string().oneOf(ORDER_STATUSES).required("Status is required"),
  note: optionalText("Note", 500).when("status", {
    is: (s: string) => s === "CANCELLED" || s === "RETURNED",
    then: (s) => s.required("Please give a reason"),
  }),
  courier: optionalText("Courier", 100),
  trackingNumber: optionalText("Tracking number", 100),
});

export const shipmentSchema = Yup.object({
  courier: optionalText("Courier", 100),
  trackingNumber: optionalText("Tracking number", 100),
});

/** Payment received against an order, or a refund paid on a cancelled / returned order. */
export const orderPaymentSchema = Yup.object({
  direction: Yup.string().oneOf(["RECEIVED", "MADE"]).default("RECEIVED"),
  paymentDate: requiredDay("Payment date"),
  amount: positiveRupees("Amount").required("Amount is required"),
  method: Yup.string().oneOf(PAYMENT_METHODS, "Choose a payment method").required("Choose a payment method"),
  accountId: optionalObjectId("Account"),
  transactionRef: optionalText("Transaction reference", 100),
  notes: optionalText("Notes", 500),
});

export type OrderPaymentInput = Yup.InferType<typeof orderPaymentSchema>;
