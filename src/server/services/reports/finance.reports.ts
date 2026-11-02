import "server-only";
import type { Filter } from "../../http/query";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/financeTypes";
import { bucketKeys, bucketLabel, bucketOf } from "@/lib/periods";
import type { ReportRow } from "@/lib/reportTypes";
import { Account } from "../../models/Account";
import { FinanceTransaction } from "../../models/FinanceTransaction";
import { Order } from "../../models/Order";
import { Payment } from "../../models/Payment";
import { dayMatch, pageRows, rupees, searchMatch, sortOpt, window, type ReportDef } from "./engine";
import * as m from "./metrics";

const fallbackRange = (r: m.Range | null): m.Range => r ?? { from: "2000-01-01", to: "2999-12-31" };

export const profitLossReport: ReportDef = {
  meta: {
    key: "profit-loss",
    group: "finance",
    title: "Profit & Loss",
    description: "Revenue by source, cost of goods sold, gross profit, expenses by category and net profit",
    dateMode: "required",
    searchPlaceholder: "Search line items...",
  },
  permission: "report",
  columns: [
    { key: "section", label: "Section" },
    { key: "line", label: "Line Item" },
    { key: "amount", label: "Amount", format: "money", align: "right" },
  ],
  sorts: [sortOpt("statement", "Statement order", "order", 1)],
  async run(ctx) {
    const r = ctx.range;
    const [income, expense, cogs] = await Promise.all([m.incomeByCategory(r), m.expenseByCategory(r), m.cogs(m.saleOrderMatch(r))]);
    const revenue = [...income.values()].reduce((s, v) => s + v, 0);
    const totalExpense = [...expense.values()].reduce((s, v) => s + v.total, 0);
    const gross = revenue - cogs;
    const net = gross - totalExpense;
    const rows: ReportRow[] = [];
    const add = (section: string, line: string, paise: number, tone?: ReportRow["tone"]) =>
      rows.push({ _id: `${rows.length}`, order: rows.length, section, line, amount: rupees(paise), tone, strong: tone ? 1 : 0 });
    for (const c of INCOME_CATEGORIES) add("Revenue", INCOME_CATEGORY_LABELS[c], income.get(c) ?? 0);
    add("Revenue", "Total Revenue", revenue, "brand");
    add("Cost of Goods", "Cost of goods sold (qty × cost price)", -cogs);
    add("Gross Profit", "Gross Profit", gross, gross >= 0 ? "success" : "danger");
    for (const c of EXPENSE_CATEGORIES) add("Expenses", EXPENSE_CATEGORY_LABELS[c], -(expense.get(c)?.total ?? 0));
    add("Expenses", "Total Expenses", -totalExpense, "brand");
    add("Net Profit", "Net Profit", net, net >= 0 ? "success" : "danger");
    return {
      rows: ctx.search ? rows.filter((x) => String(x.line).toLowerCase().includes(ctx.search.toLowerCase())) : rows,
      total: rows.length,
      summary: [
        { label: "Revenue", value: rupees(revenue), format: "money", tone: "in" },
        { label: "Gross profit", value: rupees(gross), format: "money" },
        { label: "Expenses", value: rupees(totalExpense), format: "money", tone: "out" },
        { label: "Net profit", value: rupees(net), format: "money", tone: net >= 0 ? "in" : "out" },
      ],
    };
  },
};

export const cashFlowReport: ReportDef = {
  meta: {
    key: "cash-flow",
    group: "finance",
    title: "Cash Flow Report",
    description: "Money received and paid out per period with the running cash & bank balance",
    dateMode: "required",
    searchPlaceholder: "Search period...",
  },
  permission: "report",
  columns: [
    { key: "label", label: "Period" },
    { key: "received", label: "Received", format: "money", align: "right" },
    { key: "made", label: "Paid Out", format: "money", align: "right" },
    { key: "net", label: "Net Cash Flow", format: "signed", align: "right" },
    { key: "balance", label: "Closing Balance", format: "money", align: "right" },
  ],
  sorts: [sortOpt("asc", "Oldest first", "key", 1), sortOpt("desc", "Newest first", "key", -1)],
  async run(ctx) {
    const r = fallbackRange(ctx.range);
    const [series, accounts, beforeIn, beforeOut] = await Promise.all([
      m.paymentSeries(r),
      Account.aggregate<{ total: number }>([{ $match: { status: "active" } }, { $group: { _id: null, total: { $sum: "$openingBalancePaise" } } }]),
      m.paymentsIn({ from: "0000-01-01", to: prevDay(r.from) }),
      m.paymentsOut({ from: "0000-01-01", to: prevDay(r.from) }),
    ]);
    let balance = (accounts[0]?.total ?? 0) + beforeIn.total - beforeOut.total;
    const opening = balance;
    const rows: ReportRow[] = bucketKeys(r.from, r.to).map((k) => {
      const received = series.get(`${k}|RECEIVED`) ?? 0;
      const made = series.get(`${k}|MADE`) ?? 0;
      balance += received - made;
      return { _id: k, key: k, label: bucketLabel(k), received: rupees(received), made: rupees(made), net: rupees(received - made), balance: rupees(balance) };
    });
    const totalIn = rows.reduce((s, x) => s + Number(x.received), 0);
    const totalOut = rows.reduce((s, x) => s + Number(x.made), 0);
    const out = pageRows(rows, ctx);
    out.summary = [
      { label: "Opening balance", value: rupees(opening), format: "money" },
      { label: "Received", value: totalIn, format: "money", tone: "in" },
      { label: "Paid out", value: totalOut, format: "money", tone: "out" },
      { label: "Closing balance", value: rupees(balance), format: "money" },
    ];
    out.chart = {
      title: `Received vs paid out per ${bucketOf(r.from, r.to)}`,
      series: [
        { key: "received", label: "Received" },
        { key: "made", label: "Paid out" },
      ],
      points: rows.map((x) => ({ label: String(x.label), received: Number(x.received), made: Number(x.made) })),
    };
    return out;
  },
};

function prevDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const salesRevenueReport: ReportDef = {
  meta: {
    key: "sales-revenue",
    group: "finance",
    title: "Sales & Revenue Report",
    description: "Revenue per period split by marketplace, local, distributor sales and other income",
    dateMode: "required",
    searchPlaceholder: "Search period...",
  },
  permission: "report",
  columns: [
    { key: "label", label: "Period" },
    { key: "orders", label: "Orders", format: "number", align: "right" },
    { key: "MARKETPLACE_SALES", label: "Marketplace", format: "money", align: "right" },
    { key: "LOCAL_SALES", label: "Local", format: "money", align: "right" },
    { key: "DISTRIBUTOR_SALES", label: "Distributor", format: "money", align: "right" },
    { key: "OTHER_INCOME", label: "Other Income", format: "money", align: "right" },
    { key: "revenue", label: "Total Revenue", format: "money", align: "right" },
  ],
  sorts: [sortOpt("asc", "Oldest first", "key", 1), sortOpt("desc", "Newest first", "key", -1), sortOpt("top", "Highest revenue", "revenue", -1)],
  async run(ctx) {
    const r = fallbackRange(ctx.range);
    const unit = bucketOf(r.from, r.to);
    const keyExpr = (f: string) => (unit === "day" ? `$${f}` : { $substrBytes: [`$${f}`, 0, 7] });
    const [income, orders] = await Promise.all([
      FinanceTransaction.aggregate<{ _id: { b: string; c: string }; total: number }>([
        { $match: m.incomeMatch(r) },
        { $group: { _id: { b: keyExpr("txnDate"), c: "$category" }, total: { $sum: "$amountPaise" } } },
      ]),
      Order.aggregate<{ _id: string; count: number }>([
        { $match: m.saleOrderMatch(r) },
        { $group: { _id: keyExpr("orderDate"), count: { $sum: 1 } } },
      ]),
    ]);
    const byKey = new Map(income.map((x) => [`${x._id.b}|${x._id.c}`, x.total]));
    const countBy = new Map(orders.map((x) => [x._id, x.count]));
    const rows: ReportRow[] = bucketKeys(r.from, r.to).map((k) => {
      const row: ReportRow = { _id: k, key: k, label: bucketLabel(k), orders: countBy.get(k) ?? 0 };
      let total = 0;
      for (const c of INCOME_CATEGORIES) {
        const v = byKey.get(`${k}|${c}`) ?? 0;
        row[c] = rupees(v);
        total += v;
      }
      row.revenue = rupees(total);
      return row;
    });
    const sum = (f: string) => rows.reduce((s, x) => s + Number(x[f] ?? 0), 0);
    const out = pageRows(rows, ctx);
    out.summary = [
      { label: "Orders", value: sum("orders"), format: "number" },
      { label: "Marketplace", value: sum("MARKETPLACE_SALES"), format: "money" },
      { label: "Local", value: sum("LOCAL_SALES"), format: "money" },
      { label: "Distributor", value: sum("DISTRIBUTOR_SALES"), format: "money" },
      { label: "Total revenue", value: sum("revenue"), format: "money", tone: "in" },
    ];
    out.chart = {
      title: `Revenue per ${unit}`,
      series: [
        { key: "MARKETPLACE_SALES", label: "Marketplace" },
        { key: "LOCAL_SALES", label: "Local" },
        { key: "DISTRIBUTOR_SALES", label: "Distributor" },
        { key: "OTHER_INCOME", label: "Other income" },
      ],
      points: rows.map((x) => ({
        label: String(x.label),
        MARKETPLACE_SALES: Number(x.MARKETPLACE_SALES),
        LOCAL_SALES: Number(x.LOCAL_SALES),
        DISTRIBUTOR_SALES: Number(x.DISTRIBUTOR_SALES),
        OTHER_INCOME: Number(x.OTHER_INCOME),
      })),
    };
    return out;
  },
};

/** Reports module → Finance Report: every payment in and out (money register). */
export const financeRegisterReport: ReportDef = {
  meta: {
    key: "finance",
    group: "reports",
    title: "Finance Report",
    description: "Every payment received and made, with reference, party, method and account",
    dateMode: "required",
    searchPlaceholder: "Search by payment no., reference, party or transaction ref...",
  },
  permission: "report",
  columns: [
    { key: "paymentDate", label: "Date", format: "date" },
    { key: "paymentNo", label: "Payment No.", format: "mono" },
    { key: "direction", label: "Type", format: "badge" },
    { key: "referenceLabel", label: "Reference", format: "mono" },
    { key: "partyName", label: "Party" },
    { key: "method", label: "Method" },
    { key: "account", label: "Account" },
    { key: "moneyIn", label: "In", format: "money", align: "right" },
    { key: "moneyOut", label: "Out", format: "money", align: "right" },
    { key: "transactionRef", label: "Txn Ref", format: "mono", hiddenByDefault: true },
  ],
  sorts: [sortOpt("newest", "Newest first", "paymentDate", -1), sortOpt("oldest", "Oldest first", "paymentDate", 1), sortOpt("amount", "Largest amount", "amountPaise", -1)],
  filters: async () => [
    { key: "direction", allLabel: "In & Out", options: [{ value: "RECEIVED", label: "Received" }, { value: "MADE", label: "Paid out" }] },
    { key: "method", allLabel: "All Methods", options: PAYMENT_METHODS.map((x) => ({ value: x, label: PAYMENT_METHOD_LABELS[x] })) },
  ],
  async run(ctx) {
    const match: Filter = {
      ...dayMatch("paymentDate", ctx.range),
      ...searchMatch(ctx.search, ["paymentNo", "referenceLabel", "partyName", "transactionRef"]),
      ...(ctx.filters.direction ? { direction: ctx.filters.direction } : {}),
      ...(ctx.filters.method ? { method: ctx.filters.method } : {}),
    };
    const { skip, limit } = window(ctx);
    const [docs, total, sums, accounts] = await Promise.all([
      Payment.find(match).sort({ [ctx.sort.field]: ctx.sort.dir, createdAt: ctx.sort.dir }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(match),
      Payment.aggregate<{ _id: string; total: number }>([{ $match: match }, { $group: { _id: "$direction", total: { $sum: "$amountPaise" } } }]),
      Account.find().select("name").lean(),
    ]);
    const accName = new Map(accounts.map((a) => [String(a._id), a.name]));
    const inSum = sums.find((x) => x._id === "RECEIVED")?.total ?? 0;
    const outSum = sums.find((x) => x._id === "MADE")?.total ?? 0;
    const rows: ReportRow[] = docs.map((p) => ({
      _id: String(p._id),
      href: p.referenceType === "ORDER" && p.referenceId ? `/dashboard/orders/${p.referenceId}` : p.referenceType === "EXPENSE" && p.referenceId ? `/dashboard/finance/expenses/${p.referenceId}` : undefined,
      paymentDate: p.paymentDate,
      paymentNo: p.paymentNo,
      direction: p.direction === "RECEIVED" ? "Received" : "Paid out",
      tone: p.direction === "RECEIVED" ? "success" : "danger",
      referenceLabel: p.referenceLabel || (p.referenceType === "GENERAL" ? "General" : p.referenceType === "INCOME" ? "Other income" : ""),
      partyName: p.partyName || "—",
      method: PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
      account: p.account ? accName.get(String(p.account)) ?? "—" : "—",
      moneyIn: p.direction === "RECEIVED" ? rupees(p.amountPaise) : null,
      moneyOut: p.direction === "MADE" ? rupees(p.amountPaise) : null,
      transactionRef: p.transactionRef || "",
    }));
    return {
      rows,
      total,
      summary: [
        { label: "Received", value: rupees(inSum), format: "money", tone: "in" },
        { label: "Paid out", value: rupees(outSum), format: "money", tone: "out" },
        { label: "Net", value: rupees(inSum - outSum), format: "money" },
      ],
    };
  },
};
