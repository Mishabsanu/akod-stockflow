import "server-only";
import { newDeleteBatch, softDelete } from "../../models/softDelete";
import { isValidObjectId } from "mongoose";
import type { OrderStatus, PaymentStatus } from "@/lib/commerceTypes";
import { INCOME_CATEGORIES, type Income, type PaymentMethod } from "@/lib/financeTypes";
import { fromPaise, toPaise } from "@/lib/money";
import type { Paginated } from "@/lib/types";
import type { IncomeInput } from "@/lib/validation/finance.schema";
import { nextCode } from "../../models/Counter";
import { FinanceTransaction, type FinanceTransactionDoc } from "../../models/FinanceTransaction";
import { Payment } from "../../models/Payment";
import { AppError, notFound } from "../../http/errors";
import { paginate, searchFilter, type Filter, type ListQuery } from "../../http/query";
import { postPayment } from "./paymentCore";
import { dayRangeFilter, enumFilter, skipOf } from "./shared";

export const INCOME_FILTERS = ["category", "source", "from", "to"];

/** Income row plus the linked order's status, for the list. */
export type IncomeRow = Income & {
  order: { _id: string; orderNo: string; status: OrderStatus; paymentStatus: PaymentStatus } | null;
};

type PopulatedIncome = Omit<FinanceTransactionDoc, "order"> & {
  order: { _id: unknown; orderNo: string; status: OrderStatus; paymentStatus: PaymentStatus } | null;
};

function toRow(d: PopulatedIncome): IncomeRow {
  return {
    _id: String(d._id),
    txnNo: d.txnNo,
    txnDate: d.txnDate,
    category: d.category,
    order: d.order ? { _id: String(d.order._id), orderNo: d.order.orderNo, status: d.order.status, paymentStatus: d.order.paymentStatus } : null,
    description: d.description ?? "",
    amount: fromPaise(d.amountPaise),
    paymentMethod: d.paymentMethod ?? "",
    referenceNo: d.referenceNo ?? "",
    source: d.source,
    status: d.status,
    createdAt: d.createdAt?.toISOString(),
  };
}

function buildFilter(query: ListQuery): Filter {
  const status = query.status === "ACTIVE" || query.status === "REVERSED" ? { status: query.status } : {};
  return {
    ...searchFilter(query.search, ["txnNo", "description", "referenceNo"]),
    ...status,
    ...enumFilter("category", query.filters.category, INCOME_CATEGORIES),
    ...enumFilter("source", query.filters.source, ["ORDER", "MANUAL"]),
    ...dayRangeFilter("txnDate", query.filters.from, query.filters.to),
  };
}

export async function listIncome(query: ListQuery): Promise<Paginated<IncomeRow> & { totalAmount: number }> {
  const filter = buildFilter(query);
  const [docs, total, sum] = await Promise.all([
    FinanceTransaction.find(filter)
      .sort({ txnDate: -1, createdAt: -1 })
      .skip(skipOf(query))
      .limit(query.limit)
      .populate("order", "orderNo status paymentStatus")
      .lean<PopulatedIncome[]>(),
    FinanceTransaction.countDocuments(filter),
    FinanceTransaction.aggregate<{ total: number }>([
      { $match: { ...filter, status: "ACTIVE" } },
      { $group: { _id: null, total: { $sum: "$amountPaise" } } },
    ]),
  ]);
  return { ...paginate(docs.map(toRow), total, query), totalAmount: fromPaise(sum[0]?.total ?? 0) };
}

export async function getIncome(id: string): Promise<IncomeRow> {
  if (!isValidObjectId(id)) throw notFound("Income");
  const doc = await FinanceTransaction.findById(id).populate("order", "orderNo status paymentStatus").lean<PopulatedIncome>();
  if (!doc) throw notFound("Income");
  return toRow(doc);
}

/** Other income: booked and received at once (an INCOME-linked payment brings the money in). */
export async function createOtherIncome(input: IncomeInput, userId: string): Promise<IncomeRow> {
  const txn = await FinanceTransaction.create({
    txnNo: await nextCode("income", "INC", 5),
    txnDate: input.txnDate,
    category: input.category,
    description: input.description,
    amountPaise: toPaise(input.amount),
    paymentMethod: input.paymentMethod,
    referenceNo: input.referenceNo,
    source: "MANUAL",
    status: "ACTIVE",
    createdBy: userId,
  });
  try {
    const payment = await postPayment({
      paymentDate: input.txnDate,
      direction: "RECEIVED",
      referenceType: "INCOME",
      referenceId: txn._id,
      amountPaise: toPaise(input.amount),
      method: input.paymentMethod as PaymentMethod,
      accountId: input.accountId || null,
      transactionRef: input.referenceNo,
      notes: input.description,
      partyName: "",
      userId,
    });
    await Payment.updateOne({ _id: payment._id }, { $set: { referenceLabel: txn.txnNo } });
    await FinanceTransaction.updateOne({ _id: txn._id }, { $set: { payment: payment._id } });
  } catch (error) {
    await FinanceTransaction.deleteOne({ _id: txn._id });
    throw error;
  }
  return getIncome(String(txn._id));
}

/** Only manual income can be deleted (order income follows its order). Its payment goes with it. */
export async function deleteIncome(id: string, userId?: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Income");
  const doc = await FinanceTransaction.findById(id).lean();
  if (!doc) throw notFound("Income");
  if (doc.source === "ORDER") {
    throw new AppError("Order income is managed by its order — cancel or return the order instead.", 409);
  }
  // One batch: restoring the income from the Recycle Bin brings its payment back too
  const batch = newDeleteBatch();
  await softDelete(Payment, { referenceType: "INCOME", referenceId: doc._id }, { batch, userId });
  await softDelete(FinanceTransaction, { _id: doc._id }, { batch, userId, primary: true });
}
