import "server-only";
import { isValidObjectId } from "mongoose";
import { sortBatchCodes, type BatchLookupResult, type Manufacturer } from "@/lib/batchCodeTypes";
import type { Paginated } from "@/lib/types";
import type { ManufacturerInput } from "@/lib/validation/manufacturer.schema";
import { AppError, notFound } from "../http/errors";
import { escapeRegex, paginate, searchFilter, statusFilter, type Filter, type ListQuery } from "../http/query";
import { Manufacturer as ManufacturerModel, type ManufacturerDoc } from "../models/Manufacturer";
import { toPlain } from "../utils/serialize";

const PUBLIC_FIELDS = "-createdBy -__v";

function toManufacturer(doc: ManufacturerDoc): Manufacturer {
  const m = toPlain<Manufacturer>(doc);
  return { ...m, batchCodes: sortBatchCodes(m.batchCodes ?? []) };
}

function clean(input: ManufacturerInput) {
  return { ...input, batchCodes: [...new Set(input.batchCodes.map((c) => c.trim().toUpperCase()))] };
}

/** Search matches name, address, FSSAI no, or an exact batch code. */
export async function listManufacturers(query: ListQuery): Promise<Paginated<Manufacturer>> {
  const filter: Filter = { ...statusFilter(query.status) };
  if (query.search) {
    const base = searchFilter(query.search, ["name", "address", "fssaiLicNo"]).$or as Filter[];
    filter.$or = [...base, { batchCodes: new RegExp(`^${escapeRegex(query.search.toUpperCase())}$`) }];
  }
  const [items, total] = await Promise.all([
    ManufacturerModel.find(filter)
      .sort({ name: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select(PUBLIC_FIELDS)
      .lean<ManufacturerDoc[]>(),
    ManufacturerModel.countDocuments(filter),
  ]);
  return paginate(items.map(toManufacturer), total, query);
}

export async function getManufacturer(id: string): Promise<Manufacturer> {
  if (!isValidObjectId(id)) throw notFound("Manufacturer");
  const doc = await ManufacturerModel.findById(id).select(PUBLIC_FIELDS).lean<ManufacturerDoc>();
  if (!doc) throw notFound("Manufacturer");
  return toManufacturer(doc);
}

/** Clear message naming the code and its current owner (the unique index is the final guard). */
async function assertCodesFree(codes: string[], exceptId?: string) {
  const clash = await ManufacturerModel.findOne({ batchCodes: { $in: codes }, ...(exceptId && { _id: { $ne: exceptId } }) })
    .select("name batchCodes")
    .lean();
  if (!clash) return;
  const taken = sortBatchCodes(codes.filter((c) => clash.batchCodes.includes(c)));
  const message = `Batch code${taken.length > 1 ? "s" : ""} ${taken.join(", ")} already belong${taken.length > 1 ? "" : "s"} to ${clash.name}`;
  throw new AppError(message, 409, { batchCodes: message });
}

export async function createManufacturer(input: ManufacturerInput, userId: string): Promise<Manufacturer> {
  const data = clean(input);
  await assertCodesFree(data.batchCodes);
  const doc = await ManufacturerModel.create({ ...data, createdBy: userId });
  return getManufacturer(String(doc._id));
}

export async function updateManufacturer(id: string, input: ManufacturerInput): Promise<Manufacturer> {
  if (!isValidObjectId(id)) throw notFound("Manufacturer");
  const data = clean(input);
  await assertCodesFree(data.batchCodes, id);
  const doc = await ManufacturerModel.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
  if (!doc) throw notFound("Manufacturer");
  return getManufacturer(id);
}

export async function deleteManufacturer(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Manufacturer");
  const deleted = await ManufacturerModel.findByIdAndDelete(id);
  if (!deleted) throw notFound("Manufacturer");
}

/**
 * Batch code on a pack → manufacturer. Accepts the prefix ("27") or the full printed code ("27B0912"):
 * the longest saved code that the typed text starts with wins. Inactive manufacturers are not found.
 */
export async function lookupBatchCode(raw: string): Promise<BatchLookupResult | null> {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40);
  if (!code) return null;
  const prefixes = Array.from({ length: Math.min(code.length, 10) }, (_, i) => code.slice(0, i + 1));
  const docs = await ManufacturerModel.find({ status: "active", batchCodes: { $in: prefixes } }).select(PUBLIC_FIELDS).lean<ManufacturerDoc[]>();
  let best: BatchLookupResult | null = null;
  for (const doc of docs) {
    const matched = prefixes.filter((p) => doc.batchCodes.includes(p)).sort((a, b) => b.length - a.length)[0];
    if (matched && (!best || matched.length > best.matchedCode.length)) best = { matchedCode: matched, manufacturer: toManufacturer(doc) };
  }
  return best;
}
