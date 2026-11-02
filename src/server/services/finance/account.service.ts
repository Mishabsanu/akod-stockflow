import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { AccountType, FinanceAccount } from "@/lib/financeTypes";
import { fromPaise, toPaise } from "@/lib/money";
import type { Option } from "@/lib/types";
import type { AccountInput } from "@/lib/validation/finance.schema";
import { Account, type AccountDoc } from "../../models/Account";
import { Payment } from "../../models/Payment";
import { AppError, notFound } from "../../http/errors";

/** Net movement (received − made) per account, optionally before a day (exclusive). */
export async function netByAccount(before?: string): Promise<Map<string, number>> {
  const match: Record<string, unknown> = {};
  if (before) match.paymentDate = { $lt: before };
  const rows = await Payment.aggregate<{ _id: Types.ObjectId | null; net: number }>([
    { $match: match },
    {
      $group: {
        _id: "$account",
        net: { $sum: { $cond: [{ $eq: ["$direction", "RECEIVED"] }, "$amountPaise", { $multiply: ["$amountPaise", -1] }] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.net]));
}

function toAccount(d: AccountDoc, netPaise = 0): FinanceAccount {
  return {
    _id: String(d._id),
    code: d.code,
    name: d.name,
    type: d.type,
    openingBalance: fromPaise(d.openingBalancePaise),
    balance: fromPaise(d.openingBalancePaise + netPaise),
    isDefault: d.isDefault,
    description: d.description ?? "",
    status: d.status,
  };
}

/** All accounts with their current balance (opening + received − paid). */
export async function listAccounts(): Promise<FinanceAccount[]> {
  const [docs, net] = await Promise.all([Account.find().sort({ type: 1, name: 1 }).lean<AccountDoc[]>(), netByAccount()]);
  return docs.map((d) => toAccount(d, net.get(String(d._id)) ?? 0));
}

export async function getAccount(id: string): Promise<FinanceAccount> {
  if (!isValidObjectId(id)) throw notFound("Account");
  const doc = await Account.findById(id).lean<AccountDoc>();
  if (!doc) throw notFound("Account");
  const net = await netByAccount();
  return toAccount(doc, net.get(String(doc._id)) ?? 0);
}

/** One default per type: making this the default clears the others of the same type. */
async function applyDefault(id: Types.ObjectId | string, type: AccountType, isDefault: boolean) {
  if (isDefault) await Account.updateMany({ type, _id: { $ne: id } }, { $set: { isDefault: false } });
}

const fields = (input: AccountInput) => ({
  code: input.code.toUpperCase(),
  name: input.name,
  type: input.type as AccountType,
  openingBalancePaise: toPaise(input.openingBalance),
  isDefault: input.isDefault,
  description: input.description,
  status: input.status,
});

export async function createAccount(input: AccountInput): Promise<FinanceAccount> {
  const doc = await Account.create(fields(input));
  await applyDefault(doc._id, doc.type, doc.isDefault);
  return getAccount(String(doc._id));
}

export async function updateAccount(id: string, input: AccountInput): Promise<FinanceAccount> {
  if (!isValidObjectId(id)) throw notFound("Account");
  const existing = await Account.findById(id).select("type").lean();
  if (!existing) throw notFound("Account");
  if (existing.type !== input.type && (await Payment.exists({ account: existing._id }))) {
    throw new AppError("This account has payments, so its type cannot change", 409, { type: "Has payments" });
  }
  await Account.updateOne({ _id: id }, { $set: fields(input) }, { runValidators: true });
  await applyDefault(id, input.type as AccountType, input.isDefault);
  return getAccount(id);
}

export async function deleteAccount(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Account");
  const existing = await Account.findById(id).select("_id").lean();
  if (!existing) throw notFound("Account");
  if (await Payment.exists({ account: existing._id })) {
    throw new AppError("This account has payments. Set it to inactive instead.", 409);
  }
  await Account.deleteOne({ _id: id });
}

/** Active accounts for payment forms. */
export async function listAccountOptions(): Promise<(Option & { type: string; isDefault: boolean })[]> {
  const docs = await Account.find({ status: "active" }).sort({ type: 1, name: 1 }).select("name type isDefault").lean();
  return docs.map((d) => ({ value: String(d._id), label: `${d.name} (${d.type === "CASH" ? "Cash" : "Bank"})`, type: d.type, isDefault: d.isDefault }));
}
