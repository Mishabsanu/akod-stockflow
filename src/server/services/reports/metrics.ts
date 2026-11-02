import "server-only";
import { SALE_STATUSES, type OrderType } from "@/lib/commerceTypes";
import type { ExpenseCategory, IncomeCategory } from "@/lib/financeTypes";
import { bucketOf } from "@/lib/periods";
import { Expense } from "../../models/Expense";
import { FinanceTransaction } from "../../models/FinanceTransaction";
import { Order } from "../../models/Order";
import { Payment } from "../../models/Payment";
import type { Filter } from "../../http/query";

/**
 * Figures shared by the dashboards and reports. All amounts in paise.
 *  Revenue   = active income (order income + other income) by income date
 *  Sales     = orders in a sale status by order date
 *  COGS      = sold quantity × product cost price
 *  Expenses  = non-cancelled expenses by expense date
 */
export interface Range {
  from: string;
  to: string;
}

export const ORDER_INCOME: Record<OrderType, IncomeCategory> = {
  MARKETPLACE: "MARKETPLACE_SALES",
  LOCAL: "LOCAL_SALES",
  DISTRIBUTOR: "DISTRIBUTOR_SALES",
};

const between = (field: string, r: Range) => ({ [field]: { $gte: r.from, $lte: r.to } });

export function saleOrderMatch(r: Range | null, orderType?: OrderType | ""): Filter {
  return {
    status: { $in: SALE_STATUSES },
    ...(r ? between("orderDate", r) : {}),
    ...(orderType ? { orderType } : {}),
  };
}

export function incomeMatch(r: Range | null, orderType?: OrderType | ""): Filter {
  return {
    status: "ACTIVE",
    ...(r ? between("txnDate", r) : {}),
    ...(orderType ? { category: ORDER_INCOME[orderType] } : {}),
  };
}

export const expenseMatch = (r: Range | null): Filter => ({ status: { $ne: "CANCELLED" }, ...(r ? between("expenseDate", r) : {}) });

async function sum(model: typeof Order | typeof FinanceTransaction | typeof Expense | typeof Payment, match: Filter, field: string) {
  const [row] = await (model as typeof Order).aggregate<{ total: number; count: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } },
  ]);
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

export const revenue = (r: Range | null, orderType?: OrderType | "") => sum(FinanceTransaction, incomeMatch(r, orderType), "amountPaise");
export const sales = (r: Range | null, orderType?: OrderType | "") => sum(Order, saleOrderMatch(r, orderType), "totalPaise");
export const expenses = (r: Range | null) => sum(Expense, expenseMatch(r), "amountPaise");
export const paymentsIn = (r: Range | null) =>
  sum(Payment, { direction: "RECEIVED", ...(r ? between("paymentDate", r) : {}) }, "amountPaise");
export const paymentsOut = (r: Range | null) =>
  sum(Payment, { direction: "MADE", ...(r ? between("paymentDate", r) : {}) }, "amountPaise");

/** Money still owed on sold orders (all dates — receivables are an "as of today" figure). */
export const receivables = (orderType?: OrderType | "") =>
  sum(Order, { ...saleOrderMatch(null, orderType), outstandingPaise: { $gt: 0 } }, "outstandingPaise");

export const payables = () => sum(Expense, { status: { $ne: "CANCELLED" }, balancePaise: { $gt: 0 } }, "balancePaise");

/** Cost of goods sold for orders matching `match` (current product cost price). */
export async function cogs(match: Filter): Promise<number> {
  const [row] = await Order.aggregate<{ total: number }>([
    { $match: match },
    { $unwind: "$items" },
    { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "p", pipeline: [{ $project: { costPricePaise: 1 } }] } },
    { $group: { _id: null, total: { $sum: { $multiply: ["$items.quantity", { $ifNull: [{ $first: "$p.costPricePaise" }, 0] }] } } } },
  ]);
  return row?.total ?? 0;
}

/** Sold orders by type: count, value, COGS. */
export async function salesByType(r: Range | null) {
  const rows = await Order.aggregate<{ _id: OrderType; count: number; total: number }>([
    { $match: saleOrderMatch(r) },
    { $group: { _id: "$orderType", count: { $sum: 1 }, total: { $sum: "$totalPaise" } } },
  ]);
  return new Map(rows.map((x) => [x._id, { count: x.count, total: x.total }]));
}

export async function incomeByCategory(r: Range | null) {
  const rows = await FinanceTransaction.aggregate<{ _id: IncomeCategory; total: number }>([
    { $match: incomeMatch(r) },
    { $group: { _id: "$category", total: { $sum: "$amountPaise" } } },
  ]);
  return new Map(rows.map((x) => [x._id, x.total]));
}

export async function expenseByCategory(r: Range | null) {
  const rows = await Expense.aggregate<{ _id: ExpenseCategory; total: number; count: number }>([
    { $match: expenseMatch(r) },
    { $group: { _id: "$category", total: { $sum: "$amountPaise" }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((x) => [x._id, { total: x.total, count: x.count }]));
}

/** Group expression: day string as is, or "YYYY-MM". */
const bucketExpr = (field: string, r: Range) =>
  bucketOf(r.from, r.to) === "day" ? `$${field}` : { $substrBytes: [`$${field}`, 0, 7] };

async function perBucket(
  model: typeof Order | typeof FinanceTransaction | typeof Expense | typeof Payment,
  match: Filter,
  dateField: string,
  amountField: string,
  r: Range,
  splitField?: string
): Promise<Map<string, number>> {
  const rows = await (model as typeof Order).aggregate<{ _id: { b: string; s?: string }; total: number }>([
    { $match: match },
    { $group: { _id: { b: bucketExpr(dateField, r), ...(splitField ? { s: `$${splitField}` } : {}) }, total: { $sum: `$${amountField}` } } },
  ]);
  return new Map(rows.map((x) => [splitField ? `${x._id.b}|${x._id.s}` : x._id.b, x.total]));
}

export const salesSeries = (r: Range, orderType?: OrderType | "") =>
  perBucket(Order, saleOrderMatch(r, orderType), "orderDate", "totalPaise", r, "orderType");
export const revenueSeries = (r: Range, orderType?: OrderType | "") =>
  perBucket(FinanceTransaction, incomeMatch(r, orderType), "txnDate", "amountPaise", r);
export const expenseSeries = (r: Range) => perBucket(Expense, expenseMatch(r), "expenseDate", "amountPaise", r);
export const paymentSeries = (r: Range) =>
  perBucket(Payment, between("paymentDate", r), "paymentDate", "amountPaise", r, "direction");
