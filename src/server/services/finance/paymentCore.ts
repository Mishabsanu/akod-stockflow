import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import { SALE_STATUSES } from "@/lib/commerceTypes";
import type { PaymentDirection, PaymentMethod, PaymentRefType } from "@/lib/financeTypes";
import { fromPaise } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import { nextCode } from "../../models/Counter";
import { Expense } from "../../models/Expense";
import { Order } from "../../models/Order";
import { Payment, type PaymentDoc } from "../../models/Payment";
import { AppError, notFound } from "../../http/errors";
import { recomputeExpense, recomputeOrder, resolveAccount } from "./settlement";

export interface PostPaymentInput {
  paymentDate: string;
  direction: PaymentDirection;
  referenceType: PaymentRefType;
  referenceId?: string | Types.ObjectId | null;
  amountPaise: number;
  method: PaymentMethod;
  accountId?: string | null;
  transactionRef?: string;
  notes?: string;
  /** GENERAL payments only; linked payments take the party from the order / expense */
  partyName?: string;
  userId?: string;
}

const tooMuch = (what: string, max: number) =>
  new AppError(`Amount is more than the ${what} (${formatCurrency(fromPaise(max))})`, 422, { amount: `At most ${formatCurrency(fromPaise(max))}` });

/** Works out who the payment is with and checks it does not over-settle the order / expense. */
async function checkReference(input: PostPaymentInput): Promise<{ label: string; party: string }> {
  const { referenceType, referenceId, direction, amountPaise } = input;
  if (referenceType === "GENERAL" || referenceType === "INCOME") {
    return { label: "", party: input.partyName ?? "" };
  }
  if (!referenceId || !isValidObjectId(referenceId)) throw new AppError("Select the order or expense this payment is for", 422);

  if (referenceType === "ORDER") {
    const order = await Order.findById(referenceId).populate<{ channel: { name: string } | null }>("channel", "name").lean();
    if (!order) throw notFound("Order");
    const party = order.customerName || order.channel?.name || "";
    if (direction === "RECEIVED") {
      if (!(SALE_STATUSES as string[]).includes(order.status)) {
        throw new AppError("Payments can be received only for confirmed, processing or completed orders", 409);
      }
      if (amountPaise > order.outstandingPaise) throw tooMuch("outstanding amount", order.outstandingPaise);
    } else {
      if (order.status !== "CANCELLED" && order.status !== "RETURNED") {
        throw new AppError("A refund can be paid only on a cancelled or returned order", 409);
      }
      if (amountPaise > order.paidPaise) throw tooMuch("amount received", order.paidPaise);
    }
    return { label: order.orderNo, party };
  }

  // EXPENSE
  if (direction !== "MADE") throw new AppError("Expense payments are always payments made", 422);
  const expense = await Expense.findById(referenceId).lean();
  if (!expense) throw notFound("Expense");
  if (expense.status === "CANCELLED") throw new AppError("This expense is cancelled", 409);
  if (amountPaise > expense.balancePaise) throw tooMuch("balance due", expense.balancePaise);
  return { label: expense.expenseNo, party: expense.payeeName ?? "" };
}

/** Records one payment and re-derives the balances of whatever it settles. */
export async function postPayment(input: PostPaymentInput): Promise<PaymentDoc> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) throw new AppError("Amount must be more than 0", 422);
  const { label, party } = await checkReference(input);
  const doc = await Payment.create({
    paymentNo: await nextCode("payment", "PAY", 5),
    paymentDate: input.paymentDate,
    direction: input.direction,
    referenceType: input.referenceType,
    referenceId: input.referenceId ?? null,
    referenceLabel: label,
    partyName: party,
    amountPaise: input.amountPaise,
    method: input.method,
    account: await resolveAccount(input.method, input.accountId),
    transactionRef: input.transactionRef ?? "",
    notes: input.notes ?? "",
    createdBy: input.userId,
  });
  await recomputeFor(doc.referenceType, doc.referenceId);
  return doc.toObject();
}

export async function recomputeFor(referenceType: PaymentRefType, referenceId?: Types.ObjectId | string | null) {
  if (referenceType === "ORDER") await recomputeOrder(referenceId);
  if (referenceType === "EXPENSE") await recomputeExpense(referenceId);
}
