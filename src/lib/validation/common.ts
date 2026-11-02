import * as Yup from "yup";

export const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,20}$/;

export const requiredText = (label: string, max = 120) =>
  Yup.string()
    .trim()
    .required(`${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalText = (label: string, max = 500) =>
  Yup.string().trim().max(max, `${label} must be at most ${max} characters`).default("");

export const requiredPhone = (label: string) =>
  Yup.string()
    .trim()
    .required(`${label} is required`)
    .matches(PHONE_PATTERN, `${label} must be a valid phone number`);

export const optionalEmail = (label: string) =>
  Yup.string().trim().lowercase().email(`${label} must be a valid email`).default("");

export const requiredEmail = (label: string) =>
  Yup.string().trim().lowercase().required(`${label} is required`).email(`${label} must be a valid email`);

export const statusField = Yup.string()
  .oneOf(["active", "inactive"], "Status must be active or inactive")
  .default("active");

export const objectId = (label: string) =>
  Yup.string()
    .required(`${label} is required`)
    .matches(/^[a-f0-9]{24}$/i, `${label} is invalid`);

export type FieldErrors = Record<string, string>;

/** Flattens a Yup ValidationError into { field: firstMessage }. */
export function toFieldErrors(error: Yup.ValidationError): FieldErrors {
  const errors: FieldErrors = {};
  const list = error.inner.length ? error.inner : [error];
  for (const e of list) {
    const key = e.path || "_form";
    if (!errors[key]) errors[key] = e.message;
  }
  return errors;
}

export const optionalPhone = (label: string) =>
  Yup.string()
    .trim()
    .default("")
    .test("phone", `${label} must be a valid phone number`, (v) => !v || PHONE_PATTERN.test(v));

/** Indian GSTIN: 2-digit state code, PAN, entity number, Z, checksum. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const optionalGstin = Yup.string()
  .trim()
  .uppercase()
  .default("")
  .test("gstin", "GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5", (v) => !v || GSTIN_PATTERN.test(v));

/** An emptied number input sends "" — treat it as "not entered" so the default applies. */
const blankToUndefined = (value: unknown, original: unknown) =>
  original === "" || original === null ? undefined : value;

/** Rupee amount: not negative, at most 2 decimals. Blank means 0. */
export const rupees = (label: string) =>
  Yup.number()
    .transform(blankToUndefined)
    .typeError(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)
    .test("paise", `${label} can have at most 2 decimals`, (v) => v === undefined || Math.abs(v * 100 - Math.round(v * 100)) < 1e-6)
    .default(0);

export const wholeNumber = (label: string, min = 0) =>
  Yup.number()
    .transform(blankToUndefined)
    .typeError(`${label} must be a number`)
    .integer(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .default(min);

export const optionalObjectId = (label: string) =>
  Yup.string()
    .default("")
    .test("object-id", `${label} is invalid`, (v) => !v || /^[a-f0-9]{24}$/i.test(v));

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (v?: string) => !v || (DAY_PATTERN.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));

/** Calendar date as sent by <input type="date">: "YYYY-MM-DD". */
export const requiredDay = (label: string) =>
  Yup.string().trim().required(`${label} is required`).test("day", `${label} is not a valid date`, validDay);

export const optionalDay = (label: string) =>
  Yup.string().trim().default("").test("day", `${label} is not a valid date`, validDay);

/** Material quantity (kg, ltr, pcs …): above 0, at most 3 decimals. */
export const quantity = (label: string) =>
  Yup.number()
    .transform(blankToUndefined)
    .typeError(`${label} must be a number`)
    .required(`${label} is required`)
    .moreThan(0, `${label} must be more than 0`)
    .max(10000000, `${label} is too large`)
    .test("milli", `${label} can have at most 3 decimals`, (v) => v === undefined || Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6);

/** Rupee amount that must be above 0 (vouchers). */
export const positiveRupees = (label: string) =>
  rupees(label).moreThan(0, `${label} must be more than 0`).max(100000000, `${label} is too large`);
