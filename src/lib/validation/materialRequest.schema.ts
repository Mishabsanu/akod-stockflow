import * as Yup from "yup";
import { MR_PRIORITIES } from "../materialRequestTypes";
import { objectId, optionalDay, optionalText, requiredDay } from "./common";

const qty = (label: string) =>
  Yup.number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .typeError(`${label} must be a number`)
    .required(`${label} is required`)
    .integer(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1`)
    .max(1000000, `${label} is too large`);

export const mrItemSchema = Yup.object({
  product: objectId("Product"),
  quantity: qty("Required quantity"),
  priority: Yup.string().oneOf(MR_PRIORITIES, "Choose High, Medium or Low").default("MEDIUM"),
});

/** Raise / edit a request. "Requested by" is never sent — the server uses the signed-in user. */
export const materialRequestSchema = Yup.object({
  requestDate: requiredDay("Request date"),
  requiredBy: optionalDay("Required by date").test(
    "after-request",
    "Required by date cannot be before the request date",
    function (v) {
      return !v || !this.parent.requestDate || v >= this.parent.requestDate;
    }
  ),
  items: Yup.array()
    .of(mrItemSchema)
    .min(1, "Add at least one product")
    .max(200, "At most 200 products per request")
    .test("unique", "Each product can be added only once", (items) => {
      const ids = (items ?? []).map((i) => i?.product).filter(Boolean);
      return new Set(ids).size === ids.length;
    })
    .required(),
  notes: optionalText("Notes", 1000),
});

export type MaterialRequestInput = Yup.InferType<typeof materialRequestSchema>;

export const mrActionSchema = Yup.object({
  action: Yup.string().oneOf(["approve", "reject", "cancel"], "Unknown action").required(),
  reason: optionalText("Reason", 500).when("action", {
    is: "reject",
    then: (s) => s.required("Give a reason for rejecting"),
  }),
});

export type MrActionInput = Yup.InferType<typeof mrActionSchema>;

/** Receive stock against an approved request (partial receipts allowed). */
export const mrReceiveSchema = Yup.object({
  receiptDate: requiredDay("Received date"),
  poNumber: optionalText("PO number", 60),
  lines: Yup.array()
    .of(
      Yup.object({
        product: objectId("Product"),
        quantity: Yup.number()
          .transform((v, o) => (o === "" || o === null ? undefined : v))
          .typeError("Quantity must be a number")
          .integer("Quantity must be a whole number")
          .min(0, "Quantity cannot be negative")
          .default(0),
      })
    )
    .test("some", "Enter a received quantity for at least one product", (lines) => (lines ?? []).some((l) => (l?.quantity ?? 0) > 0))
    .required(),
});

export type MrReceiveInput = Yup.InferType<typeof mrReceiveSchema>;
