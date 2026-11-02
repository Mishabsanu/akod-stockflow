import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { SALE_STATUSES, type Customer, type CustomerKind } from "@/lib/commerceTypes";
import { fromPaise } from "@/lib/money";
import type { Paginated } from "@/lib/types";
import type { CustomerInput } from "@/lib/validation/customer.schema";
import { nextCode } from "../models/Counter";
import { Customer as CustomerModel, type CustomerDoc } from "../models/Customer";
import { Order } from "../models/Order";
import { AppError, notFound } from "../http/errors";
import { paginate, searchFilter, statusFilter, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";

export const CUSTOMER_FILTERS = ["kind"];

/** Customer option for the order form (carries what the form pre-fills). */
export interface CustomerOption {
  value: string;
  label: string;
  phone: string;
  address: string;
  creditDays: number;
}

const SEARCH_FIELDS = ["code", "name", "contactPerson", "phone", "email", "gstin"];

function toCustomer(doc: CustomerDoc, outstandingPaise = 0): Customer {
  const plain = toPlain<Customer & { createdBy?: unknown; __v?: number }>(doc);
  delete plain.createdBy;
  delete plain.__v;
  return { ...plain, outstanding: fromPaise(outstandingPaise) };
}

/** Outstanding (paise) per customer across their open sale orders. */
async function outstandingByCustomer(ids: Types.ObjectId[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await Order.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { customer: { $in: ids }, status: { $in: SALE_STATUSES } } },
    { $group: { _id: "$customer", total: { $sum: "$outstandingPaise" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

export async function listCustomers(query: ListQuery): Promise<Paginated<Customer>> {
  const filter: Filter = { ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  const kind = query.filters.kind;
  if (kind === "local" || kind === "distributor") filter.kind = kind;
  const [docs, total] = await Promise.all([
    CustomerModel.find(filter)
      .sort(query.sort === "name" ? { name: 1 } : { createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<CustomerDoc[]>(),
    CustomerModel.countDocuments(filter),
  ]);
  const owed = await outstandingByCustomer(docs.map((d) => d._id));
  return paginate(
    docs.map((d) => toCustomer(d, owed.get(String(d._id)))),
    total,
    query
  );
}

export async function getCustomer(id: string): Promise<Customer> {
  if (!isValidObjectId(id)) throw notFound("Customer");
  const doc = await CustomerModel.findById(id).lean<CustomerDoc>();
  if (!doc) throw notFound("Customer");
  const owed = await outstandingByCustomer([doc._id]);
  return toCustomer(doc, owed.get(String(doc._id)));
}

const fields = (input: CustomerInput) => ({
  kind: input.kind as CustomerKind,
  name: input.name,
  contactPerson: input.contactPerson,
  phone: input.phone,
  email: input.email,
  address: input.address,
  gstin: input.gstin,
  creditDays: input.creditDays,
  status: input.status,
});

export async function createCustomer(input: CustomerInput, userId: string): Promise<Customer> {
  const doc = await CustomerModel.create({ ...fields(input), code: await nextCode("customer", "CUS"), createdBy: userId });
  return getCustomer(String(doc._id));
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  if (!isValidObjectId(id)) throw notFound("Customer");
  const existing = await CustomerModel.findById(id).select("kind").lean();
  if (!existing) throw notFound("Customer");
  if (existing.kind !== input.kind && (await Order.exists({ customer: existing._id }))) {
    throw new AppError("This contact already has orders, so its type cannot be changed", 409, { kind: "Type cannot change once orders exist" });
  }
  await CustomerModel.updateOne({ _id: id }, { $set: fields(input) }, { runValidators: true });
  return getCustomer(id);
}

export async function deleteCustomer(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Customer");
  if (await Order.exists({ customer: id })) {
    throw new AppError("This contact has orders. Set it to inactive instead.", 409);
  }
  const res = await CustomerModel.deleteOne({ _id: id });
  if (!res.deletedCount) throw notFound("Customer");
}

/** Active contacts of one kind for the order form. */
export async function listCustomerOptions(kind: CustomerKind): Promise<CustomerOption[]> {
  const docs = await CustomerModel.find({ kind, status: "active" })
    .sort({ name: 1 })
    .select("name code phone address creditDays")
    .limit(2000)
    .lean();
  return docs.map((d) => ({
    value: String(d._id),
    label: `${d.name} (${d.code})`,
    phone: d.phone ?? "",
    address: d.address ?? "",
    creditDays: d.creditDays ?? 0,
  }));
}

/** All customers matching the list filters (Excel / CSV export). */
export async function exportCustomers(params: URLSearchParams): Promise<Customer[]> {
  const filter: Filter = { ...searchFilter((params.get("search") ?? "").trim(), SEARCH_FIELDS), ...statusFilter(params.get("status") ?? "") };
  const kind = params.get("kind");
  if (kind === "local" || kind === "distributor") filter.kind = kind;
  const docs = await CustomerModel.find(filter).sort({ name: 1 }).limit(20000).lean<CustomerDoc[]>();
  const owed = await outstandingByCustomer(docs.map((d) => d._id));
  return docs.map((d) => toCustomer(d, owed.get(String(d._id))));
}
