import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { todayIST } from "@/lib/indiaDate";
import type { Offer } from "@/lib/commerceTypes";
import type { Paginated } from "@/lib/types";
import { offerState, type OfferInput } from "@/lib/validation/offer.schema";
import { notFound } from "../http/errors";
import { paginate, searchFilter, statusFilter, type ListQuery } from "../http/query";
import { Offer as OfferModel, type OfferDoc } from "../models/Offer";
import { Product } from "../models/Product";
import { toPlain } from "../utils/serialize";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

type LeanOffer = OfferDoc & { _id: Types.ObjectId };

/** Stored shape: only the list that matches "applies to" is kept. */
function toDoc(input: OfferInput) {
  return {
    name: input.name.trim(),
    description: input.description ?? "",
    discountType: input.discountType,
    value: Number(input.value),
    appliesTo: input.appliesTo,
    categories: input.appliesTo === "categories" ? input.categories : [],
    products: input.appliesTo === "products" ? input.products.map((id) => new Types.ObjectId(id)) : [],
    startDate: input.startDate ?? "",
    endDate: input.endDate ?? "",
    status: input.status,
  };
}

async function withDetails(docs: LeanOffer[]): Promise<Offer[]> {
  const today = todayIST();
  const ids = [...new Set(docs.flatMap((d) => d.products.map(String)))];
  const names = ids.length
    ? new Map((await Product.find({ _id: { $in: ids } }).select("name").lean()).map((p) => [String(p._id), p.name]))
    : new Map<string, string>();
  return docs.map((d) => {
    const o = toPlain<Offer>(d);
    return {
      ...o,
      products: d.products.map(String),
      productNames: d.products.map((id) => names.get(String(id)) ?? "Deleted product"),
      state: offerState(d, today),
    };
  });
}

export async function listOfferPage(query: ListQuery): Promise<Paginated<Offer>> {
  const filter = { ...searchFilter(query.search, ["name", "description"]), ...statusFilter(query.status) };
  const [items, total] = await Promise.all([
    OfferModel.find(filter)
      .sort(SORTS[query.sort] || SORTS.newest)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v -createdBy")
      .lean<LeanOffer[]>(),
    OfferModel.countDocuments(filter),
  ]);
  return paginate(await withDetails(items), total, query);
}

export async function getOffer(id: string): Promise<Offer> {
  if (!isValidObjectId(id)) throw notFound("Offer");
  const doc = await OfferModel.findById(id).select("-__v -createdBy").lean<LeanOffer>();
  if (!doc) throw notFound("Offer");
  return (await withDetails([doc]))[0];
}

export async function createOffer(input: OfferInput, userId: string): Promise<Offer> {
  const doc = await OfferModel.create({ ...toDoc(input), createdBy: userId });
  return getOffer(String(doc._id));
}

export async function updateOffer(id: string, input: OfferInput): Promise<Offer> {
  if (!isValidObjectId(id)) throw notFound("Offer");
  const res = await OfferModel.updateOne({ _id: id }, { $set: toDoc(input) });
  if (res.matchedCount === 0) throw notFound("Offer");
  return getOffer(id);
}

export async function deleteOffer(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Offer");
  const res = await OfferModel.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw notFound("Offer");
}

/** Offers running today (India): active and within their dates. Used by the storefront catalog. */
export async function liveOffers(): Promise<LeanOffer[]> {
  const today = todayIST();
  const docs = await OfferModel.find({ status: "active" }).lean<LeanOffer[]>();
  return docs.filter((o) => offerState(o, today) === "live");
}
