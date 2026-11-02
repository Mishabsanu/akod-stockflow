import "server-only";
import type { Filter } from "../../http/query";
import { ORDER_TYPE_LABELS, ORDER_TYPES, PAYMENT_STATUS_LABELS, type OrderType, type PaymentStatus } from "@/lib/commerceTypes";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  type ExpenseCategory,
  type ExpenseStatus,
} from "@/lib/financeTypes";
import { todayIST } from "@/lib/indiaDate";
import type { ReportRow } from "@/lib/reportTypes";
import { Channel } from "../../models/Channel";
import { Expense } from "../../models/Expense";
import { Order } from "../../models/Order";
import { ageInDays, agingBucket, dayMatch, pageRows, rupees, searchMatch, searchRows, sortOpt, window, type ReportDef } from "./engine";
import { saleOrderMatch } from "./metrics";
import { channelFilter, toId } from "./sales.reports";

const AGING = ["Not due", "0-30 days", "31-60 days", "61-90 days", "90+ days"];
const agingFilter = { key: "aging", allLabel: "All Ages", options: AGING.map((a) => ({ value: a, label: a })) };
const EXPENSE_TONE: Record<ExpenseStatus, ReportRow["tone"]> = { PENDING: "warning", PARTIAL: "info", PAID: "success", CANCELLED: "neutral" };
const PAY_TONE: Record<PaymentStatus, ReportRow["tone"]> = { UNPAID: "danger", PARTIAL: "warning", PAID: "success", REFUND_DUE: "info" };

export const expenseReport: ReportDef = {
  meta: {
    key: "expenses",
    group: "finance",
    title: "Expense Report",
    description: "Expenses by date and category with amount paid and balance due",
    dateMode: "required",
    searchPlaceholder: "Search by expense no., payee, description or reference...",
  },
  permission: "report",
  columns: [
    { key: "expenseNo", label: "Expense No.", format: "mono" },
    { key: "expenseDate", label: "Date", format: "date" },
    { key: "category", label: "Category" },
    { key: "payeeName", label: "Payee" },
    { key: "channel", label: "Marketplace", hiddenByDefault: true },
    { key: "description", label: "Description", hiddenByDefault: true },
    { key: "amount", label: "Amount", format: "money", align: "right" },
    { key: "paid", label: "Paid", format: "money", align: "right" },
    { key: "balance", label: "Balance", format: "money", align: "right" },
    { key: "status", label: "Status", format: "badge", align: "center" },
  ],
  sorts: [sortOpt("newest", "Newest first", "expenseDate", -1), sortOpt("oldest", "Oldest first", "expenseDate", 1), sortOpt("amount", "Highest amount", "amountPaise", -1)],
  filters: async () => [
    { key: "category", allLabel: "All Categories", options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] })) },
    { key: "expenseStatus", allLabel: "All Status", options: Object.entries(EXPENSE_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
  ],
  async run(ctx) {
    const match: Filter = {
      ...dayMatch("expenseDate", ctx.range),
      ...searchMatch(ctx.search, ["expenseNo", "payeeName", "description", "referenceNo"]),
      ...(ctx.filters.category ? { category: ctx.filters.category } : {}),
      ...(ctx.filters.expenseStatus ? { status: ctx.filters.expenseStatus } : {}),
    };
    const { skip, limit } = window(ctx);
    const [docs, total, sums, channels] = await Promise.all([
      Expense.find(match).sort({ [ctx.sort.field]: ctx.sort.dir, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Expense.countDocuments(match),
      Expense.aggregate<{ amount: number; paid: number; balance: number }>([
        { $match: { ...match, status: { $ne: "CANCELLED" } } },
        { $group: { _id: null, amount: { $sum: "$amountPaise" }, paid: { $sum: "$paidPaise" }, balance: { $sum: "$balancePaise" } } },
      ]),
      Channel.find().select("name").lean(),
    ]);
    const chName = new Map(channels.map((c) => [String(c._id), c.name]));
    const rows: ReportRow[] = docs.map((e) => ({
      _id: String(e._id),
      href: `/dashboard/finance/expenses/${e._id}`,
      expenseNo: e.expenseNo,
      expenseDate: e.expenseDate,
      category: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory],
      payeeName: e.payeeName || "—",
      channel: e.channel ? chName.get(String(e.channel)) ?? "" : "",
      description: e.description || "",
      amount: rupees(e.amountPaise),
      paid: rupees(e.paidPaise),
      balance: rupees(e.balancePaise),
      status: EXPENSE_STATUS_LABELS[e.status as ExpenseStatus],
      tone: EXPENSE_TONE[e.status as ExpenseStatus],
    }));
    const s = sums[0];
    return {
      rows,
      total,
      summary: [
        { label: "Total expenses", value: rupees(s?.amount), format: "money", tone: "out" },
        { label: "Paid", value: rupees(s?.paid), format: "money" },
        { label: "Balance due", value: rupees(s?.balance), format: "money", tone: "out" },
      ],
    };
  },
};

export const receivablesReport: ReportDef = {
  meta: {
    key: "receivables",
    group: "finance",
    title: "Receivables",
    description: "Money still owed on confirmed orders — local customers, distributors and marketplace settlements",
    dateMode: "optional",
    searchPlaceholder: "Search by order no., customer or marketplace...",
  },
  permission: "payment",
  columns: [
    { key: "party", label: "Customer / Distributor / Marketplace" },
    { key: "orderNo", label: "Order", format: "mono" },
    { key: "orderType", label: "Type" },
    { key: "orderDate", label: "Order Date", format: "date", hiddenByDefault: true },
    { key: "total", label: "Total", format: "money", align: "right" },
    { key: "paid", label: "Paid", format: "money", align: "right" },
    { key: "outstanding", label: "Outstanding", format: "money", align: "right" },
    { key: "dueDate", label: "Due Date", format: "date" },
    { key: "paymentStatus", label: "Status", format: "badge", align: "center" },
    { key: "aging", label: "Aging", align: "center" },
  ],
  sorts: [
    sortOpt("due", "Oldest due first", "dueKey", 1),
    sortOpt("outstanding", "Highest outstanding", "outstanding", -1),
    sortOpt("party", "Party (A–Z)", "party", 1),
  ],
  filters: async () => [
    { key: "orderType", allLabel: "All Types", options: ORDER_TYPES.map((t) => ({ value: t, label: ORDER_TYPE_LABELS[t] })) },
    agingFilter,
    await channelFilter(),
  ],
  async run(ctx) {
    const today = todayIST();
    const docs = await Order.aggregate([
      {
        $match: {
          ...saleOrderMatch(ctx.range, (ctx.filters.orderType as OrderType) || ""),
          outstandingPaise: { $gt: 0 },
          ...(ctx.filters.channel ? { channel: toId(ctx.filters.channel) } : {}),
        },
      },
      { $lookup: { from: "channels", localField: "channel", foreignField: "_id", as: "ch", pipeline: [{ $project: { name: 1 } }] } },
      { $project: { orderNo: 1, orderType: 1, orderDate: 1, dueDate: 1, customerName: 1, totalPaise: 1, paidPaise: 1, outstandingPaise: 1, paymentStatus: 1, channelName: { $first: "$ch.name" } } },
    ]);
    let rows: ReportRow[] = docs.map((o) => {
      const due = o.dueDate || o.orderDate;
      return {
        _id: String(o._id),
        href: `/dashboard/orders/${o._id}`,
        actionHref: `/dashboard/orders/${o._id}?pay=1`,
        actionLabel: "Record payment",
        party: o.orderType === "MARKETPLACE" ? o.channelName || "Marketplace" : o.customerName || "Walk-in",
        orderNo: o.orderNo,
        orderType: ORDER_TYPE_LABELS[o.orderType as OrderType],
        orderDate: o.orderDate,
        total: rupees(o.totalPaise),
        paid: rupees(o.paidPaise),
        outstanding: rupees(o.outstandingPaise),
        dueDate: due,
        dueKey: due,
        paymentStatus: PAYMENT_STATUS_LABELS[o.paymentStatus as PaymentStatus],
        tone: PAY_TONE[o.paymentStatus as PaymentStatus],
        aging: agingBucket(due, today),
        overdue: ageInDays(due, today) > 0 ? rupees(o.outstandingPaise) : 0,
      };
    });
    if (ctx.filters.aging) rows = rows.filter((r) => r.aging === ctx.filters.aging);
    rows = searchRows(rows, ctx.search, ["party", "orderNo"]);
    const out = pageRows(rows, ctx);
    const sum = (f: string) => rows.reduce((s, r) => s + Number(r[f] ?? 0), 0);
    out.summary = [
      { label: "Open orders", value: rows.length, format: "number" },
      { label: "Total outstanding", value: sum("outstanding"), format: "money", tone: "in" },
      { label: "Overdue", value: sum("overdue"), format: "money", tone: "out" },
    ];
    return out;
  },
};

export const payablesReport: ReportDef = {
  meta: {
    key: "payables",
    group: "finance",
    title: "Payables",
    description: "Unpaid and partly paid expenses — operational costs, marketplace fees and other business expenses",
    dateMode: "optional",
    searchPlaceholder: "Search by expense no., payee or description...",
  },
  permission: "payment",
  columns: [
    { key: "payeeName", label: "Payee" },
    { key: "expenseNo", label: "Expense Ref", format: "mono" },
    { key: "category", label: "Category" },
    { key: "expenseDate", label: "Expense Date", format: "date", hiddenByDefault: true },
    { key: "amount", label: "Total", format: "money", align: "right" },
    { key: "paid", label: "Paid", format: "money", align: "right" },
    { key: "balance", label: "Outstanding", format: "money", align: "right" },
    { key: "dueDate", label: "Due Date", format: "date" },
    { key: "status", label: "Status", format: "badge", align: "center" },
    { key: "aging", label: "Aging", align: "center" },
  ],
  sorts: [sortOpt("due", "Oldest due first", "dueKey", 1), sortOpt("balance", "Highest outstanding", "balance", -1), sortOpt("payee", "Payee (A–Z)", "payeeName", 1)],
  filters: async () => [
    { key: "category", allLabel: "All Categories", options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] })) },
    agingFilter,
  ],
  async run(ctx) {
    const today = todayIST();
    const match: Filter = {
      status: { $ne: "CANCELLED" },
      balancePaise: { $gt: 0 },
      ...dayMatch("expenseDate", ctx.range),
      ...(ctx.filters.category ? { category: ctx.filters.category } : {}),
    };
    const docs = await Expense.find(match).lean();
    let rows: ReportRow[] = docs.map((e) => {
      const due = e.dueDate || e.expenseDate;
      return {
        _id: String(e._id),
        href: `/dashboard/finance/expenses/${e._id}`,
        actionHref: `/dashboard/finance/expenses/${e._id}?pay=1`,
        actionLabel: "Record payment",
        payeeName: e.payeeName || "—",
        expenseNo: e.expenseNo,
        category: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory],
        expenseDate: e.expenseDate,
        description: e.description || "",
        amount: rupees(e.amountPaise),
        paid: rupees(e.paidPaise),
        balance: rupees(e.balancePaise),
        dueDate: due,
        dueKey: due,
        status: EXPENSE_STATUS_LABELS[e.status as ExpenseStatus],
        tone: EXPENSE_TONE[e.status as ExpenseStatus],
        aging: agingBucket(due, today),
        overdue: ageInDays(due, today) > 0 ? rupees(e.balancePaise) : 0,
      };
    });
    if (ctx.filters.aging) rows = rows.filter((r) => r.aging === ctx.filters.aging);
    rows = searchRows(rows, ctx.search, ["payeeName", "expenseNo", "description", "category"]);
    const out = pageRows(rows, ctx);
    const sum = (f: string) => rows.reduce((s, r) => s + Number(r[f] ?? 0), 0);
    out.summary = [
      { label: "Open expenses", value: rows.length, format: "number" },
      { label: "Total payable", value: sum("balance"), format: "money", tone: "out" },
      { label: "Overdue", value: sum("overdue"), format: "money", tone: "out" },
    ];
    return out;
  },
};

export const marketplaceRevenueReport: ReportDef = {
  meta: {
    key: "marketplace-revenue",
    group: "finance",
    title: "Marketplace Revenue Report",
    description: "Sales, marketplace fees and net revenue per marketplace, with amount settled and still due",
    dateMode: "required",
    searchPlaceholder: "Search marketplace...",
  },
  permission: "report",
  columns: [
    { key: "name", label: "Marketplace" },
    { key: "code", label: "Code", format: "mono", hiddenByDefault: true },
    { key: "orders", label: "Orders", format: "number", align: "right" },
    { key: "units", label: "Units", format: "number", align: "right" },
    { key: "gross", label: "Gross Sales", format: "money", align: "right" },
    { key: "fees", label: "Marketplace Fees", format: "money", align: "right" },
    { key: "net", label: "Net Revenue", format: "money", align: "right" },
    { key: "received", label: "Settled", format: "money", align: "right" },
    { key: "outstanding", label: "Pending Settlement", format: "money", align: "right" },
  ],
  sorts: [sortOpt("gross", "Highest sales", "gross", -1), sortOpt("net", "Highest net", "net", -1), sortOpt("name", "Name (A–Z)", "name", 1)],
  async run(ctx) {
    const [channels, sales, fees] = await Promise.all([
      Channel.find().select("name code").lean(),
      Order.aggregate<{ _id: unknown; orders: number; gross: number; paid: number; outstanding: number; units: number }>([
        { $match: saleOrderMatch(ctx.range, "MARKETPLACE") },
        {
          $group: {
            _id: "$channel",
            orders: { $sum: 1 },
            gross: { $sum: "$totalPaise" },
            paid: { $sum: "$paidPaise" },
            outstanding: { $sum: "$outstandingPaise" },
            units: { $sum: { $sum: "$items.quantity" } },
          },
        },
      ]),
      Expense.aggregate<{ _id: unknown; total: number }>([
        { $match: { category: "MARKETPLACE_FEES", status: { $ne: "CANCELLED" }, ...dayMatch("expenseDate", ctx.range) } },
        { $group: { _id: "$channel", total: { $sum: "$amountPaise" } } },
      ]),
    ]);
    const saleBy = new Map(sales.map((s) => [String(s._id), s]));
    const feeBy = new Map(fees.map((f) => [String(f._id), f.total]));
    let rows: ReportRow[] = channels.map((c) => {
      const s = saleBy.get(String(c._id));
      const fee = feeBy.get(String(c._id)) ?? 0;
      return {
        _id: String(c._id),
        href: `/dashboard/channels/${c._id}`,
        name: c.name,
        code: c.code,
        orders: s?.orders ?? 0,
        units: s?.units ?? 0,
        gross: rupees(s?.gross),
        fees: rupees(fee),
        net: rupees((s?.gross ?? 0) - fee),
        received: rupees(s?.paid),
        outstanding: rupees(s?.outstanding),
      };
    });
    const unassignedFees = feeBy.get("null") ?? 0;
    if (unassignedFees) {
      rows.push({ _id: "none", name: "Fees not tied to a marketplace", code: "", orders: 0, units: 0, gross: 0, fees: rupees(unassignedFees), net: -rupees(unassignedFees), received: 0, outstanding: 0 });
    }
    rows = searchRows(rows, ctx.search, ["name", "code"]);
    const out = pageRows(rows, ctx);
    const sum = (f: string) => rows.reduce((s, r) => s + Number(r[f] ?? 0), 0);
    out.summary = [
      { label: "Gross sales", value: sum("gross"), format: "money", tone: "in" },
      { label: "Marketplace fees", value: sum("fees"), format: "money", tone: "out" },
      { label: "Net revenue", value: sum("net"), format: "money" },
      { label: "Pending settlement", value: sum("outstanding"), format: "money", tone: "out" },
    ];
    return out;
  },
};

/** Sales grouped by local customer or by distributor, with paid / outstanding. */
function partySales(type: "LOCAL" | "DISTRIBUTOR", key: string, title: string, description: string): ReportDef {
  return {
    meta: { key, group: "finance", title, description, dateMode: "required", searchPlaceholder: "Search by name or phone..." },
    permission: "report",
    columns: [
      { key: "name", label: type === "LOCAL" ? "Customer" : "Distributor" },
      { key: "phone", label: "Phone" },
      { key: "orders", label: "Orders", format: "number", align: "right" },
      { key: "sales", label: "Sales", format: "money", align: "right" },
      { key: "paid", label: "Paid", format: "money", align: "right" },
      { key: "outstanding", label: "Outstanding", format: "money", align: "right" },
      { key: "lastOrder", label: "Last Order", format: "date" },
    ],
    sorts: [sortOpt("sales", "Highest sales", "sales", -1), sortOpt("outstanding", "Highest outstanding", "outstanding", -1), sortOpt("name", "Name (A–Z)", "name", 1)],
    async run(ctx) {
      const docs = await Order.aggregate<{ _id: { c: unknown; n: string }; phone: string; orders: number; sales: number; paid: number; outstanding: number; last: string }>([
        { $match: saleOrderMatch(ctx.range, type) },
        {
          $group: {
            _id: { c: "$customer", n: { $cond: [{ $gt: ["$customerName", ""] }, "$customerName", "Walk-in"] } },
            phone: { $last: "$customerPhone" },
            orders: { $sum: 1 },
            sales: { $sum: "$totalPaise" },
            paid: { $sum: "$paidPaise" },
            outstanding: { $sum: "$outstandingPaise" },
            last: { $max: "$orderDate" },
          },
        },
      ]);
      let rows: ReportRow[] = docs.map((d, i) => ({
        _id: `${d._id.c ?? "x"}-${i}`,
        name: d._id.n,
        phone: d.phone || "",
        orders: d.orders,
        sales: rupees(d.sales),
        paid: rupees(d.paid),
        outstanding: rupees(d.outstanding),
        lastOrder: d.last,
      }));
      rows = searchRows(rows, ctx.search, ["name", "phone"]);
      const out = pageRows(rows, ctx);
      const sum = (f: string) => rows.reduce((s, r) => s + Number(r[f] ?? 0), 0);
      out.summary = [
        { label: type === "LOCAL" ? "Customers" : "Distributors", value: rows.length, format: "number" },
        { label: "Sales", value: sum("sales"), format: "money", tone: "in" },
        { label: "Outstanding", value: sum("outstanding"), format: "money", tone: "out" },
      ];
      return out;
    },
  };
}

export const localSalesSummaryReport = partySales("LOCAL", "local-sales-summary", "Local Sales Report", "Local sales per customer with amount paid and outstanding");
export const distributorSalesSummaryReport = partySales(
  "DISTRIBUTOR",
  "distributor-sales-summary",
  "Distributor Sales Report",
  "Sales per distributor with credit position (paid and outstanding)"
);
