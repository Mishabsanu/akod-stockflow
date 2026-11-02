import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { SALE_STATUSES, type PaymentStatus } from "@/lib/commerceTypes";
import type { ExpenseStatus, PaymentMethod } from "@/lib/financeTypes";
import { Account } from "../../models/Account";
import { Expense } from "../../models/Expense";
import { Order } from "../../models/Order";
import { Payment } from "../../models/Payment";
import type { Filter } from "../../http/query";

/**
 * Proserve pattern: an order's or expense's paid / balance figures are never typed in —
 * they are recalculated from the payments linked to it after every payment change.
 */

/** Sum of payment amounts (paise) matching the filter. */
export async function sumPayments(filter: Filter): Promise<number> {
  const [row] = await Payment.aggregate<{ total: number }>([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$amountPaise" } } },
  ]);
  return row?.total ?? 0;
}

const oid = (id: Types.ObjectId | string) => (typeof id === "string" ? new Types.ObjectId(id) : id);

/** Net paid on an order = received − refunded. */
export async function orderNetPaid(orderId: Types.ObjectId | string): Promise<number> {
  const ref = { referenceType: "ORDER", referenceId: oid(orderId) };
  const [received, refunded] = await Promise.all([
    sumPayments({ ...ref, direction: "RECEIVED" }),
    sumPayments({ ...ref, direction: "MADE" }),
  ]);
  return received - refunded;
}

export function orderPaymentFigures(status: string, totalPaise: number, paidPaise: number) {
  const isSale = (SALE_STATUSES as string[]).includes(status);
  const closed = status === "CANCELLED" || status === "RETURNED";
  const outstandingPaise = closed ? 0 : Math.max(totalPaise - paidPaise, 0);
  let paymentStatus: PaymentStatus;
  if (closed) paymentStatus = paidPaise > 0 ? "REFUND_DUE" : "UNPAID";
  else if (paidPaise <= 0) paymentStatus = "UNPAID";
  else if (paidPaise >= totalPaise) paymentStatus = "PAID";
  else paymentStatus = "PARTIAL";
  return { outstandingPaise, paymentStatus, isSale };
}

/** Re-derives paid / outstanding / payment status of an order from its payments. */
export async function recomputeOrder(orderId: Types.ObjectId | string | null | undefined): Promise<void> {
  if (!orderId || !isValidObjectId(orderId)) return;
  const order = await Order.findById(orderId).select("status totalPaise").lean();
  if (!order) return;
  const paidPaise = await orderNetPaid(order._id);
  const { outstandingPaise, paymentStatus } = orderPaymentFigures(order.status, order.totalPaise, paidPaise);
  await Order.updateOne({ _id: order._id }, { $set: { paidPaise, outstandingPaise, paymentStatus } });
}

export function deriveExpenseStatus(amountPaise: number, paidPaise: number, current?: ExpenseStatus): ExpenseStatus {
  if (current === "CANCELLED") return "CANCELLED";
  if (paidPaise <= 0) return "PENDING";
  return paidPaise >= amountPaise ? "PAID" : "PARTIAL";
}

/** Re-derives paid / balance / status of an expense from its payments. */
export async function recomputeExpense(expenseId: Types.ObjectId | string | null | undefined): Promise<void> {
  if (!expenseId || !isValidObjectId(expenseId)) return;
  const expense = await Expense.findById(expenseId).select("amountPaise status").lean();
  if (!expense) return;
  const paidPaise = await sumPayments({ referenceType: "EXPENSE", referenceId: expense._id, direction: "MADE" });
  const balancePaise = expense.status === "CANCELLED" ? 0 : Math.max(expense.amountPaise - paidPaise, 0);
  await Expense.updateOne(
    { _id: expense._id },
    { $set: { paidPaise, balancePaise, status: deriveExpenseStatus(expense.amountPaise, paidPaise, expense.status) } }
  );
}

/**
 * Account a payment lands in: the chosen active account, otherwise the default Cash account for
 * cash and the default Bank account for everything else.
 */
export async function resolveAccount(method: PaymentMethod, accountId?: string | null): Promise<Types.ObjectId | null> {
  if (accountId && isValidObjectId(accountId)) {
    const acc = await Account.findOne({ _id: accountId, status: "active" }).select("_id").lean();
    if (acc) return acc._id;
  }
  const type = method === "CASH" ? "CASH" : "BANK";
  const acc =
    (await Account.findOne({ type, status: "active", isDefault: true }).select("_id").lean()) ??
    (await Account.findOne({ type, status: "active" }).select("_id").lean());
  return acc?._id ?? null;
}
