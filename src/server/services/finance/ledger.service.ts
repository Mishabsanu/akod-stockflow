import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { DayRange } from "@/lib/dateRange";
import type { PaymentRefType } from "@/lib/financeTypes";
import { fromPaise } from "@/lib/money";
import { Account } from "../../models/Account";
import { Payment, type PaymentDoc } from "../../models/Payment";
import { notFound } from "../../http/errors";
import { netByAccount } from "./account.service";

export interface LedgerRow {
  _id: string;
  date: string;
  paymentNo: string;
  party: string;
  referenceType: PaymentRefType;
  referenceId: string | null;
  reference: string;
  account: string;
  method: string;
  notes: string;
  in: number;
  out: number;
  balance: number;
}

export interface LedgerResult {
  account: { _id: string; name: string; code: string } | null;
  from: string;
  to: string;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  rows: LedgerRow[];
}

/**
 * Cash / bank book (Proserve ledger): payments of one account (or all) in date order with a
 * running balance. Opening = account opening balance + every movement before `from`.
 */
export async function getLedger(accountId: string | undefined, range: DayRange): Promise<LedgerResult> {
  let account: LedgerResult["account"] = null;
  const accounts = await Account.find().select("name code openingBalancePaise").lean();
  if (accountId) {
    if (!isValidObjectId(accountId)) throw notFound("Account");
    const a = accounts.find((x) => String(x._id) === accountId);
    if (!a) throw notFound("Account");
    account = { _id: String(a._id), name: a.name, code: a.code };
  }
  const scope = account ? accounts.filter((a) => String(a._id) === account!._id) : accounts;
  const before = await netByAccount(range.from);
  let openingPaise = scope.reduce((s, a) => s + a.openingBalancePaise + (before.get(String(a._id)) ?? 0), 0);
  // Payments with no account (only when no account existed) count in the all-accounts book
  if (!account) openingPaise += before.get("null") ?? 0;

  const filter: Record<string, unknown> = { paymentDate: { $gte: range.from, $lte: range.to } };
  if (account) filter.account = new Types.ObjectId(account._id);
  const docs = await Payment.find(filter)
    .sort({ paymentDate: 1, createdAt: 1 })
    .populate("account", "name")
    .lean<(Omit<PaymentDoc, "account"> & { account: { name: string } | null })[]>();

  let running = openingPaise;
  let totalIn = 0;
  let totalOut = 0;
  const rows = docs.map((p) => {
    const inP = p.direction === "RECEIVED" ? p.amountPaise : 0;
    const outP = p.direction === "MADE" ? p.amountPaise : 0;
    running += inP - outP;
    totalIn += inP;
    totalOut += outP;
    return {
      _id: String(p._id),
      date: p.paymentDate,
      paymentNo: p.paymentNo,
      party: p.partyName ?? "",
      referenceType: p.referenceType,
      referenceId: p.referenceId ? String(p.referenceId) : null,
      reference: p.referenceLabel ?? "",
      account: p.account?.name ?? "—",
      method: p.method,
      notes: p.notes ?? "",
      in: fromPaise(inP),
      out: fromPaise(outP),
      balance: fromPaise(running),
    };
  });

  return {
    account,
    from: range.from,
    to: range.to,
    opening: fromPaise(openingPaise),
    totalIn: fromPaise(totalIn),
    totalOut: fromPaise(totalOut),
    closing: fromPaise(running),
    rows,
  };
}
