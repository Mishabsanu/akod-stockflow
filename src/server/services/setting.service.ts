import "server-only";
import type { CompanySettingInput, CompanySettings } from "@/lib/validation/setting.schema";
import { Setting } from "../models/Setting";
import { toPlain } from "../utils/serialize";

const ID = "company";

const DEFAULTS: CompanySettings = {
  companyName: process.env.COMPANY_NAME || "AKOD Group",
  address: process.env.COMPANY_ADDRESS || "",
  phone: process.env.COMPANY_PHONE || "",
  email: "",
  gstin: process.env.COMPANY_GSTIN || "",
  defaultReorderLevel: 10,
};

/** Saved company details, or the .env defaults until someone saves the form. */
export async function getCompanySettings(): Promise<CompanySettings> {
  const doc = await Setting.findById(ID).select("-__v -_id -createdAt").lean();
  return doc ? { ...DEFAULTS, ...toPlain<CompanySettings>(doc) } : DEFAULTS;
}

export async function updateCompanySettings(input: CompanySettingInput): Promise<CompanySettings> {
  await Setting.updateOne({ _id: ID }, { $set: input }, { upsert: true, runValidators: true });
  return getCompanySettings();
}
