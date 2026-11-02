import * as Yup from "yup";
import { optionalEmail, optionalGstin, optionalPhone, optionalText, requiredText, wholeNumber } from "./common";

export const companySettingSchema = Yup.object({
  companyName: requiredText("Company name", 120),
  address: optionalText("Address", 300),
  phone: optionalPhone("Phone"),
  email: optionalEmail("Email"),
  gstin: optionalGstin,
  defaultReorderLevel: wholeNumber("Default low-stock level", 0),
});

export type CompanySettingInput = Yup.InferType<typeof companySettingSchema>;

export interface CompanySettings extends CompanySettingInput {
  updatedAt?: string;
}
