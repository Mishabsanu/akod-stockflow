import "server-only";
import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS, type ExpenseCategory, type IncomeCategory } from "@/lib/financeTypes";
import { bucketKeys, bucketLabel, bucketOf } from "@/lib/periods";
import { Account } from "../../models/Account";
import { Payment } from "../../models/Payment";
import { rupees } from "../reports/engine";
import * as m from "../reports/metrics";

export interface FinancePoint {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  received: number;
  made: number;
  net: number;
}

export interface FinanceDashboardData {
  range: m.Range;
  unit: "day" | "month";
  kpis: {
    revenue: number;
    expenses: number;
    cogs: number;
    grossProfit: number;
    netProfit: number;
    received: number;
    made: number;
    cashFlow: number;
    receivables: number;
    payables: number;
  };
  series: FinancePoint[];
  incomeByCategory: { key: string; label: string; value: number }[];
  expenseByCategory: { key: string; label: string; value: number }[];
  accounts: { _id: string; name: string; type: string; balance: number }[];
}

/** Cash / bank balances today: opening + every payment received − every payment made. */
async function accountBalances() {
  const [accounts, moves] = await Promise.all([
    Account.find({ status: "active" }).sort({ type: 1, name: 1 }).lean(),
    Payment.aggregate<{ _id: { a: unknown; d: string }; total: number }>([
      { $group: { _id: { a: "$account", d: "$direction" }, total: { $sum: "$amountPaise" } } },
    ]),
  ]);
  const net = new Map<string, number>();
  for (const x of moves) {
    const k = String(x._id.a);
    net.set(k, (net.get(k) ?? 0) + (x._id.d === "RECEIVED" ? x.total : -x.total));
  }
  return accounts.map((a) => ({
    _id: String(a._id),
    name: a.name,
    type: a.type,
    balance: rupees(a.openingBalancePaise + (net.get(String(a._id)) ?? 0)),
  }));
}

export async function getFinanceDashboard(range: m.Range): Promise<FinanceDashboardData> {
  const [revenue, expenses, cogs, received, made, receivables, payables, revSeries, expSeries, paySeries, income, expense, accounts] = await Promise.all([
    m.revenue(range),
    m.expenses(range),
    m.cogs(m.saleOrderMatch(range)),
    m.paymentsIn(range),
    m.paymentsOut(range),
    m.receivables(),
    m.payables(),
    m.revenueSeries(range),
    m.expenseSeries(range),
    m.paymentSeries(range),
    m.incomeByCategory(range),
    m.expenseByCategory(range),
    accountBalances(),
  ]);
  const gross = revenue.total - cogs;
  const series = bucketKeys(range.from, range.to).map((k) => {
    const r = paySeries.get(`${k}|RECEIVED`) ?? 0;
    const p = paySeries.get(`${k}|MADE`) ?? 0;
    return {
      key: k,
      label: bucketLabel(k),
      revenue: rupees(revSeries.get(k)),
      expenses: rupees(expSeries.get(k)),
      received: rupees(r),
      made: rupees(p),
      net: rupees(r - p),
    };
  });
  return {
    range,
    unit: bucketOf(range.from, range.to),
    kpis: {
      revenue: rupees(revenue.total),
      expenses: rupees(expenses.total),
      cogs: rupees(cogs),
      grossProfit: rupees(gross),
      netProfit: rupees(gross - expenses.total),
      received: rupees(received.total),
      made: rupees(made.total),
      cashFlow: rupees(received.total - made.total),
      receivables: rupees(receivables.total),
      payables: rupees(payables.total),
    },
    series,
    incomeByCategory: [...income.entries()]
      .map(([k, v]) => ({ key: k, label: INCOME_CATEGORY_LABELS[k as IncomeCategory] ?? k, value: rupees(v) }))
      .sort((a, b) => b.value - a.value),
    expenseByCategory: [...expense.entries()]
      .map(([k, v]) => ({ key: k, label: EXPENSE_CATEGORY_LABELS[k as ExpenseCategory] ?? k, value: rupees(v.total) }))
      .sort((a, b) => b.value - a.value),
    accounts,
  };
}
