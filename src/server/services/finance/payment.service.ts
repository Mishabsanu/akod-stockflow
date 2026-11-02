import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { SALE_STATUSES } from "@/lib/commerceTypes";
import { PAYMENT_METHODS, type Payment as PaymentRow, type PaymentMethod, type PaymentRefType } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { fromPaise, toPaise } from "@/lib/money";
import type { Paginated } from "@/lib/types";
import type { PaymentInput } from "@/lib/validation/finance.schema";
import { Expense } from "../../models/Expense";
import { Order } from "../../models/Order";
import { Payment, type PaymentDoc } from "../../models/Payment";
import { AppError, notFound } from "../../http/errors";
import { escapeRegex, paginate, searchFilter, type Filter, type ListQuery } from "../../http/query";
import { postPayment, recomputeFor } from "./paymentCore";
import { dayRangeFilter, enumFilter, idFilter, skipOf } from "./shared";

export const PAYMENT_FILTERS = ["direction", "method", "referenceType", "account", "from", "to"];

type PopulatedPayment = Omit<PaymentDoc, "account" | "createdBy"> & {
  account: { _id: unknown; name: string; code: string } | null;
  createdBy: { _id: unknown; name: string } | null;
};

export function toPaymentRow(d: PopulatedPayment): PaymentRow {
  return {
    _id: String(d._id),
    paymentNo: d.paymentNo,
    paymentDate: d.paymentDate,
    direction: d.direction,
    referenceType: d.referenceType,
    referenceId: d.referenceId ? String(d.referenceId) : null,
    referenceLabel: d.referenceLabel ?? "",
    partyName: d.partyName ?? "",
    amount: fromPaise(d.amountPaise),
    method: d.method,
    account: d.account ? { _id: String(d.account._id), name: d.account.name, code: d.account.code } : null,
    transactionRef: d.transactionRef ?? "",
    notes: d.notes ?? "",
    createdBy: d.createdBy ? { _id: String(d.createdBy._id), name: d.createdBy.name } : null,
    createdAt: d.createdAt?.toISOString(),
  };
}

export function paymentFilter(query: ListQuery): Filter {
  return {
    ...searchFilter(query.search, ["paymentNo", "partyName", "referenceLabel", "transactionRef", "notes"]),
    ...enumFilter("direction", query.filters.direction, ["RECEIVED", "MADE"]),
    ...enumFilter("method", query.filters.method, PAYMENT_METHODS),
    ...enumFilter("referenceType", query.filters.referenceType, ["ORDER", "EXPENSE", "INCOME", "GENERAL"]),
    ...idFilter("account", query.filters.account),
    ...dayRangeFilter("paymentDate", query.filters.from, query.filters.to),
  };
}

export async function listPayments(
  query: ListQuery
): Promise<Paginated<PaymentRow> & { totals: { received: number; made: number } }> {
  const filter = paymentFilter(query);
  const [docs, total, sums] = await Promise.all([
    Payment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skipOf(query))
      .limit(query.limit)
      .populate("account", "name code")
      .populate("createdBy", "name")
      .lean<PopulatedPayment[]>(),
    Payment.countDocuments(filter),
    Payment.aggregate<{ _id: string; total: number }>([
      { $match: filter },
      { $group: { _id: "$direction", total: { $sum: "$amountPaise" } } },
    ]),
  ]);
  const by = new Map(sums.map((s) => [s._id, s.total]));
  return {
    ...paginate(docs.map(toPaymentRow), total, query),
    totals: { received: fromPaise(by.get("RECEIVED") ?? 0), made: fromPaise(by.get("MADE") ?? 0) },
  };
}

export async function getPayment(id: string): Promise<PaymentRow> {
  if (!isValidObjectId(id)) throw notFound("Payment");
  const doc = await Payment.findById(id).populate("account", "name code").populate("createdBy", "name").lean<PopulatedPayment>();
  if (!doc) throw notFound("Payment");
  return toPaymentRow(doc);
}

/** Payments linked to one order / expense, oldest first (history panels). */
export async function listPaymentsFor(referenceType: PaymentRefType, referenceId: string): Promise<PaymentRow[]> {
  if (!isValidObjectId(referenceId)) return [];
  const docs = await Payment.find({ referenceType, referenceId: new Types.ObjectId(referenceId) })
    .sort({ paymentDate: 1, createdAt: 1 })
    .populate("account", "name code")
    .populate("createdBy", "name")
    .lean<PopulatedPayment[]>();
  return docs.map(toPaymentRow);
}

export async function createPayment(input: PaymentInput, userId: string): Promise<PaymentRow> {
  const doc = await postPayment({
    paymentDate: input.paymentDate,
    direction: input.direction as "RECEIVED" | "MADE",
    referenceType: input.referenceType as PaymentRefType,
    referenceId: input.referenceType === "GENERAL" ? null : input.referenceId,
    amountPaise: toPaise(input.amount),
    method: input.method as PaymentMethod,
    accountId: input.accountId || null,
    transactionRef: input.transactionRef,
    notes: input.notes,
    partyName: input.partyName,
    userId,
  });
  return getPayment(String(doc._id));
}

/** Deleting a payment re-opens the order / expense balance it settled. */
export async function deletePayment(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Payment");
  const doc = await Payment.findById(id).lean();
  if (!doc) throw notFound("Payment");
  if (doc.referenceType === "INCOME") {
    throw new AppError("This payment belongs to an income entry. Delete the income entry instead.", 409);
  }
  await Payment.deleteOne({ _id: doc._id });
  await recomputeFor(doc.referenceType, doc.referenceId);
}

export interface ReferenceOption {
  value: string;
  label: string;
  party: string;
  /** Most this payment may be (outstanding / refundable / balance), rupees */
  max: number;
}

/**
 * Open items a payment can settle: orders with an outstanding amount (received), cancelled /
 * returned orders with money to refund (made), and expenses with a balance (made).
 */
export async function listReferenceOptions(type: string, direction: string, search: string): Promise<ReferenceOption[]> {
  const rx = search ? new RegExp(escapeRegex(search.slice(0, 50)), "i") : null;
  if (type === "ORDER") {
    const refund = direction === "MADE";
    const filter: Filter = refund
      ? { status: { $in: ["CANCELLED", "RETURNED"] }, paidPaise: { $gt: 0 } }
      : { status: { $in: SALE_STATUSES }, outstandingPaise: { $gt: 0 } };
    if (rx) filter.$or = [{ orderNo: rx }, { customerName: rx }, { orderReference: rx }];
    const docs = await Order.find(filter)
      .sort({ orderDate: -1 })
      .limit(30)
      .populate<{ channel: { name: string } | null }>("channel", "name")
      .select("orderNo customerName orderReference outstandingPaise paidPaise channel")
      .lean();
    return docs.map((o) => {
      const party = o.customerName || o.channel?.name || "";
      const max = fromPaise(refund ? o.paidPaise : o.outstandingPaise);
      return {
        value: String(o._id),
        label: `${o.orderNo}${party ? ` — ${party}` : ""} · ${refund ? "refundable" : "due"} ${formatCurrency(max)}`,
        party,
        max,
      };
    });
  }
  if (type === "EXPENSE") {
    const filter: Filter = { status: { $in: ["PENDING", "PARTIAL"] }, balancePaise: { $gt: 0 } };
    if (rx) filter.$or = [{ expenseNo: rx }, { payeeName: rx }, { description: rx }];
    const docs = await Expense.find(filter).sort({ expenseDate: -1 }).limit(30).select("expenseNo payeeName description balancePaise").lean();
    return docs.map((e) => ({
      value: String(e._id),
      label: `${e.expenseNo}${e.payeeName ? ` — ${e.payeeName}` : e.description ? ` — ${e.description}` : ""} · due ${formatCurrency(fromPaise(e.balancePaise))}`,
      party: e.payeeName ?? "",
      max: fromPaise(e.balancePaise),
    }));
  }
  return [];
}
