import "server-only";
import { isValidObjectId } from "mongoose";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseStatus, type Payment as PaymentRow, type PaymentMethod } from "@/lib/financeTypes";
import { fromPaise, toPaise } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import type { Option, Paginated } from "@/lib/types";
import type { ExpenseInput } from "@/lib/validation/finance.schema";
import { Channel } from "../../models/Channel";
import { nextCode } from "../../models/Counter";
import { Expense as ExpenseModel, type ExpenseDoc } from "../../models/Expense";
import { Payment } from "../../models/Payment";
import { AppError, notFound } from "../../http/errors";
import { paginate, searchFilter, type Filter, type ListQuery } from "../../http/query";
import { postPayment } from "./paymentCore";
import { listPaymentsFor } from "./payment.service";
import { recomputeExpense } from "./settlement";
import { dayRangeFilter, enumFilter, idFilter, skipOf } from "./shared";

export const EXPENSE_FILTERS = ["category", "channel", "from", "to", "due"];
const STATUSES: ExpenseStatus[] = ["PENDING", "PARTIAL", "PAID", "CANCELLED"];

type PopulatedExpense = Omit<ExpenseDoc, "channel"> & { channel: { _id: unknown; name: string; code: string } | null };

export function toExpense(d: PopulatedExpense): Expense {
  return {
    _id: String(d._id),
    expenseNo: d.expenseNo,
    expenseDate: d.expenseDate,
    dueDate: d.dueDate ?? "",
    category: d.category,
    payeeName: d.payeeName ?? "",
    channel: d.channel ? { _id: String(d.channel._id), name: d.channel.name, code: d.channel.code } : null,
    description: d.description ?? "",
    amount: fromPaise(d.amountPaise),
    paid: fromPaise(d.paidPaise),
    balance: fromPaise(d.balancePaise),
    status: d.status,
    paymentMethod: d.paymentMethod ?? "",
    referenceNo: d.referenceNo ?? "",
    createdAt: d.createdAt?.toISOString(),
  };
}

export function expenseFilter(query: ListQuery): Filter {
  const filter: Filter = {
    ...searchFilter(query.search, ["expenseNo", "payeeName", "description", "referenceNo"]),
    ...enumFilter("status", query.status, STATUSES),
    ...enumFilter("category", query.filters.category, EXPENSE_CATEGORIES),
    ...idFilter("channel", query.filters.channel),
    ...dayRangeFilter("expenseDate", query.filters.from, query.filters.to),
  };
  // Open (unpaid) expenses only — used by Payables and the payment picker
  if (query.filters.due === "open") filter.status = { $in: ["PENDING", "PARTIAL"] };
  return filter;
}

export async function listExpenses(query: ListQuery): Promise<Paginated<Expense> & { totals: { amount: number; paid: number; balance: number } }> {
  const filter = expenseFilter(query);
  const [docs, total, sums] = await Promise.all([
    ExpenseModel.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skipOf(query))
      .limit(query.limit)
      .populate("channel", "name code")
      .lean<PopulatedExpense[]>(),
    ExpenseModel.countDocuments(filter),
    ExpenseModel.aggregate<{ amount: number; paid: number; balance: number }>([
      { $match: { ...filter, status: filter.status ?? { $ne: "CANCELLED" } } },
      { $group: { _id: null, amount: { $sum: "$amountPaise" }, paid: { $sum: "$paidPaise" }, balance: { $sum: "$balancePaise" } } },
    ]),
  ]);
  const s = sums[0];
  return {
    ...paginate(docs.map(toExpense), total, query),
    totals: { amount: fromPaise(s?.amount ?? 0), paid: fromPaise(s?.paid ?? 0), balance: fromPaise(s?.balance ?? 0) },
  };
}

export async function getExpense(id: string): Promise<Expense> {
  if (!isValidObjectId(id)) throw notFound("Expense");
  const doc = await ExpenseModel.findById(id).populate("channel", "name code").lean<PopulatedExpense>();
  if (!doc) throw notFound("Expense");
  return toExpense(doc);
}

export async function getExpenseWithPayments(id: string): Promise<{ expense: Expense; payments: PaymentRow[] }> {
  const expense = await getExpense(id);
  return { expense, payments: await listPaymentsFor("EXPENSE", id) };
}

async function checkChannel(channel: string): Promise<string | null> {
  if (!channel) return null;
  if (!(await Channel.exists({ _id: channel }))) throw new AppError("Selected marketplace does not exist", 422, { channel: "Not found" });
  return channel;
}

const fields = async (input: ExpenseInput) => ({
  expenseDate: input.expenseDate,
  dueDate: input.dueDate,
  category: input.category,
  payeeName: input.payeeName,
  channel: await checkChannel(input.channel),
  description: input.description,
  amountPaise: toPaise(input.amount),
  paymentMethod: input.paymentMethod,
  referenceNo: input.referenceNo,
});

export async function createExpense(input: ExpenseInput, userId: string): Promise<Expense> {
  const base = await fields(input);
  const doc = await ExpenseModel.create({
    ...base,
    expenseNo: await nextCode("expense", "EXP", 5),
    paidPaise: 0,
    balancePaise: base.amountPaise,
    status: "PENDING",
    createdBy: userId,
  });
  const paidNow = toPaise(input.paidNow);
  if (paidNow > 0) {
    try {
      await postPayment({
        paymentDate: input.expenseDate,
        direction: "MADE",
        referenceType: "EXPENSE",
        referenceId: doc._id,
        amountPaise: paidNow,
        method: input.paymentMethod as PaymentMethod,
        accountId: input.accountId || null,
        transactionRef: input.referenceNo,
        notes: "Paid when the expense was entered",
        userId,
      });
    } catch (error) {
      await ExpenseModel.deleteOne({ _id: doc._id });
      throw error;
    }
  }
  return getExpense(String(doc._id));
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  if (!isValidObjectId(id)) throw notFound("Expense");
  const existing = await ExpenseModel.findById(id).select("status paidPaise").lean();
  if (!existing) throw notFound("Expense");
  if (existing.status === "CANCELLED") throw new AppError("A cancelled expense cannot be edited", 409);
  const base = await fields(input);
  if (base.amountPaise < existing.paidPaise) {
    const msg = `Amount cannot be less than what is already paid (${formatCurrency(fromPaise(existing.paidPaise))})`;
    throw new AppError(msg, 422, { amount: msg });
  }
  await ExpenseModel.updateOne({ _id: id }, { $set: base });
  await recomputeExpense(id);
  return getExpense(id);
}

/** Cancel (keep the record) — only while nothing has been paid against it. */
export async function cancelExpense(id: string): Promise<Expense> {
  if (!isValidObjectId(id)) throw notFound("Expense");
  const existing = await ExpenseModel.findById(id).select("status").lean();
  if (!existing) throw notFound("Expense");
  if (existing.status === "CANCELLED") throw new AppError("This expense is already cancelled", 409);
  if (await Payment.exists({ referenceType: "EXPENSE", referenceId: existing._id })) {
    throw new AppError("This expense has payments. Delete its payments first, then cancel it.", 409);
  }
  await ExpenseModel.updateOne({ _id: id }, { $set: { status: "CANCELLED", balancePaise: 0, cancelledAt: new Date() } });
  return getExpense(id);
}

export async function deleteExpense(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Expense");
  const existing = await ExpenseModel.findById(id).select("_id").lean();
  if (!existing) throw notFound("Expense");
  if (await Payment.exists({ referenceType: "EXPENSE", referenceId: existing._id })) {
    throw new AppError("This expense has payments. Delete its payments first.", 409);
  }
  await ExpenseModel.deleteOne({ _id: id });
}

/** Marketplaces for the expense form (marketplace fees). */
export async function listChannelOptions(): Promise<Option[]> {
  const docs = await Channel.find({ status: "active" }).sort({ name: 1 }).select("name code").lean();
  return docs.map((d) => ({ value: String(d._id), label: d.name }));
}
