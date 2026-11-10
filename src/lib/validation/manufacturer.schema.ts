import * as Yup from "yup";
import { BATCH_CODE_PATTERN } from "../batchCodeTypes";
import { optionalPhone, optionalText, requiredText, statusField } from "./common";

export const MAX_BATCH_CODES = 500;

export const manufacturerSchema = Yup.object({
  name: requiredText("Manufacturer name", 150),
  address: requiredText("Address", 500),
  fssaiLicNo: Yup.string()
    .trim()
    .required("FSSAI licence number is required")
    .matches(/^\d{14}$/, "FSSAI licence number must be 14 digits"),
  batchCodes: Yup.array(
    Yup.string()
      .trim()
      .uppercase()
      .required()
      .matches(BATCH_CODE_PATTERN, "Batch codes may only contain letters and numbers (max 10)")
  )
    .min(1, "Add at least one batch code")
    .max(MAX_BATCH_CODES, `At most ${MAX_BATCH_CODES} batch codes`)
    .test("unique", "Each batch code can be added only once", (v) => !v || new Set(v).size === v.length)
    .default([]),
  phone: optionalPhone("Phone"),
  notes: optionalText("Notes", 1000),
  status: statusField,
});

export type ManufacturerInput = Yup.InferType<typeof manufacturerSchema>;

export const emptyManufacturer: ManufacturerInput = {
  name: "",
  address: "",
  fssaiLicNo: "",
  batchCodes: [],
  phone: "",
  notes: "",
  status: "active",
};
