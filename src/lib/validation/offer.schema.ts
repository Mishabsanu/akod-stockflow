import * as Yup from "yup";
import { optionalDay, optionalText, requiredText, statusField } from "./common";

export const OFFER_TYPES = ["percent", "flat"] as const;
export const OFFER_SCOPES = ["all", "categories", "products"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];
export type OfferScope = (typeof OFFER_SCOPES)[number];

/**
 * A storefront discount: % or ₹ off the selling price, for all products, some categories or some
 * products, optionally limited to a date range (India time, both days included).
 */
export const offerSchema = Yup.object({
  name: requiredText("Offer name", 80),
  /** Short line for the store's banner / announcement, e.g. "Celebrate Onam with Kerala's best chips" */
  description: optionalText("Message", 200),
  discountType: Yup.string().oneOf([...OFFER_TYPES], "Choose % or ₹").required().default("percent"),
  value: Yup.number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .typeError("Enter the discount")
    .required("Enter the discount")
    .moreThan(0, "Discount must be more than 0")
    .when("discountType", {
      is: "percent",
      then: (s) => s.max(90, "Use at most 90%"),
      otherwise: (s) => s.max(100000, "Discount is too large"),
    }),
  appliesTo: Yup.string().oneOf([...OFFER_SCOPES]).required().default("all"),
  categories: Yup.array(Yup.string().trim().required())
    .default([])
    .when("appliesTo", { is: "categories", then: (s) => s.min(1, "Pick at least one category") }),
  products: Yup.array(Yup.string().matches(/^[a-f0-9]{24}$/i, "Invalid product").required())
    .default([])
    .when("appliesTo", { is: "products", then: (s) => s.min(1, "Pick at least one product") }),
  startDate: optionalDay("Start date"),
  endDate: optionalDay("End date").test("after-start", "End date must be on or after the start date", function (v) {
    const start = this.parent?.startDate as string | undefined;
    return !v || !start || v >= start;
  }),
  status: statusField,
});

export type OfferInput = Yup.InferType<typeof offerSchema>;

export const emptyOffer: OfferInput = {
  name: "",
  description: "",
  discountType: "percent",
  value: 10,
  appliesTo: "all",
  categories: [],
  products: [],
  startDate: "",
  endDate: "",
  status: "active",
};

/** "15% OFF" / "₹50 OFF" */
export const offerLabel = (o: { discountType: string; value: number }) =>
  o.discountType === "percent" ? `${o.value}% OFF` : `₹${o.value} OFF`;

/** Offer price for a selling price (whole rupees, never below ₹1). */
export function applyOffer(price: number, o: { discountType: string; value: number }): number {
  const off = o.discountType === "percent" ? (price * o.value) / 100 : o.value;
  return Math.max(1, Math.round(price - off));
}

export type OfferState = "live" | "scheduled" | "expired" | "inactive";

/** Where an offer stands on `today` (YYYY-MM-DD, India). */
export function offerState(o: { status: string; startDate?: string; endDate?: string }, today: string): OfferState {
  if (o.status !== "active") return "inactive";
  if (o.startDate && today < o.startDate) return "scheduled";
  if (o.endDate && today > o.endDate) return "expired";
  return "live";
}
