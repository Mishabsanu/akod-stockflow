import * as Yup from "yup";
import { optionalEmail, optionalGstin, optionalPhone, optionalText, requiredText, statusField, wholeNumber } from "./common";

/** Local customers and distributors are lightweight contacts used on orders. */
export const customerSchema = Yup.object({
  kind: Yup.string().oneOf(["local", "distributor"], "Choose Local customer or Distributor").required("Type is required"),
  name: requiredText("Name", 150),
  contactPerson: optionalText("Contact person", 100),
  phone: optionalPhone("Phone"),
  email: optionalEmail("Email"),
  address: optionalText("Address", 500),
  gstin: optionalGstin,
  creditDays: wholeNumber("Credit days").max(365, "Credit days must be at most 365"),
  status: statusField,
});

export type CustomerInput = Yup.InferType<typeof customerSchema>;

export const emptyCustomer = (kind: "local" | "distributor" = "distributor"): CustomerInput => ({
  kind,
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  creditDays: kind === "distributor" ? 30 : 0,
  status: "active",
});
