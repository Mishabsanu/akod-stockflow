import "server-only";
import type { Filter } from "../../http/query";
import { STOCK_TXN_LABELS, STOCK_TXN_TYPES, type StockTxnType } from "@/lib/commerceTypes";
import { formatDateTime } from "@/lib/format";
import type { ReportRow } from "@/lib/reportTypes";
import { Inventory } from "../../models/Inventory";
import { Order } from "../../models/Order";
import { Product } from "../../models/Product";
import { StockTransaction } from "../../models/StockTransaction";
import { User } from "../../models/User";
import { dayMatch, pageRows, rupees, searchMatch, searchRows, sortOpt, window, type ReportDef } from "./engine";
import { saleOrderMatch } from "./metrics";

async function categoryFilter() {
  const cats = (await Product.distinct("category")).filter(Boolean).sort();
  return { key: "category", allLabel: "All Categories", options: cats.map((c) => ({ label: c, value: c })) };
}

const LEVEL_LABEL = { IN_STOCK: "In Stock", LOW_STOCK: "Low Stock", OUT_OF_STOCK: "Out of Stock" } as const;
const LEVEL_TONE = { IN_STOCK: "success", LOW_STOCK: "warning", OUT_OF_STOCK: "danger" } as const;

function levelOf(qty: number, reorder: number): keyof typeof LEVEL_LABEL {
  if (qty <= 0) return "OUT_OF_STOCK";
  return qty <= reorder ? "LOW_STOCK" : "IN_STOCK";
}

async function productsWithStock(category?: string) {
  const products = await Product.find(category ? { category } : {})
    .select("sku name category sellingPricePaise costPricePaise reorderLevel status")
    .lean();
  const stock = await Inventory.find({ product: { $in: products.map((p) => p._id) } }).select("product quantity lastMovementAt").lean();
  const byId = new Map(stock.map((s) => [String(s.product), s]));
  return products.map((p) => ({ p, inv: byId.get(String(p._id)) }));
}

export const productReport: ReportDef = {
  meta: {
    key: "products",
    group: "reports",
    title: "Product Report",
    description: "Every product with price, margin, stock and units sold in the period",
    dateMode: "optional",
    searchPlaceholder: "Search by SKU or product name...",
  },
  permission: "report",
  columns: [
    { key: "sku", label: "SKU", format: "mono" },
    { key: "name", label: "Product" },
    { key: "category", label: "Category" },
    { key: "sellingPrice", label: "Selling Price", format: "money", align: "right" },
    { key: "costPrice", label: "Cost Price", format: "money", align: "right" },
    { key: "marginPct", label: "Margin %", format: "number", align: "right" },
    { key: "stock", label: "Stock", format: "number", align: "right" },
    { key: "unitsSold", label: "Units Sold", format: "number", align: "right" },
    { key: "salesValue", label: "Sales Value", format: "money", align: "right" },
    { key: "status", label: "Status", format: "badge", align: "center" },
  ],
  sorts: [
    sortOpt("name", "Name (A–Z)", "name", 1),
    sortOpt("sku", "SKU", "sku", 1),
    sortOpt("sold", "Most sold", "unitsSold", -1),
    sortOpt("sales", "Highest sales value", "salesValue", -1),
    sortOpt("stock", "Most stock", "stock", -1),
    sortOpt("margin", "Highest margin", "marginPct", -1),
  ],
  filters: async () => [
    await categoryFilter(),
    { key: "status", allLabel: "All Status", options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] },
  ],
  async run(ctx) {
    const list = await productsWithStock(ctx.filters.category);
    const sold = await Order.aggregate<{ _id: unknown; qty: number; value: number }>([
      { $match: saleOrderMatch(ctx.range) },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" }, value: { $sum: "$items.totalPaise" } } },
    ]);
    const soldBy = new Map(sold.map((s) => [String(s._id), s]));
    let rows: ReportRow[] = list.map(({ p, inv }) => {
      const sp = rupees(p.sellingPricePaise);
      const cp = rupees(p.costPricePaise);
      const s = soldBy.get(String(p._id));
      return {
        _id: String(p._id),
        href: `/dashboard/products/${p._id}`,
        sku: p.sku,
        name: p.name,
        category: p.category || "—",
        sellingPrice: sp,
        costPrice: cp,
        marginPct: sp > 0 ? Math.round(((sp - cp) / sp) * 1000) / 10 : 0,
        stock: inv?.quantity ?? 0,
        unitsSold: s?.qty ?? 0,
        salesValue: rupees(s?.value),
        status: p.status === "active" ? "Active" : "Inactive",
        tone: p.status === "active" ? "success" : "neutral",
      };
    });
    if (ctx.filters.status) rows = rows.filter((r) => r.status === (ctx.filters.status === "active" ? "Active" : "Inactive"));
    rows = searchRows(rows, ctx.search, ["sku", "name", "category"]);
    const out = pageRows(rows, ctx);
    out.summary = [
      { label: "Products", value: rows.length, format: "number" },
      { label: "Units sold", value: rows.reduce((s, r) => s + Number(r.unitsSold), 0), format: "number" },
      { label: "Sales value", value: rows.reduce((s, r) => s + Number(r.salesValue), 0), format: "money", tone: "in" },
    ];
    return out;
  },
};

export const inventoryReport: ReportDef = {
  meta: {
    key: "inventory",
    group: "reports",
    title: "Inventory Report",
    description: "Central stock per product with reorder level, stock level and stock value at cost",
    dateMode: "none",
    searchPlaceholder: "Search by SKU or product name...",
  },
  permission: "report",
  columns: [
    { key: "sku", label: "SKU", format: "mono" },
    { key: "name", label: "Product" },
    { key: "category", label: "Category" },
    { key: "quantity", label: "Available", format: "number", align: "right" },
    { key: "reorderLevel", label: "Reorder Level", format: "number", align: "right" },
    { key: "level", label: "Level", format: "badge", align: "center" },
    { key: "costPrice", label: "Cost Price", format: "money", align: "right", hiddenByDefault: true },
    { key: "stockValue", label: "Stock Value", format: "money", align: "right" },
    { key: "lastMovement", label: "Last Movement", format: "text" },
  ],
  sorts: [
    sortOpt("name", "Name (A–Z)", "name", 1),
    sortOpt("qtyAsc", "Lowest stock first", "quantity", 1),
    sortOpt("qtyDesc", "Highest stock first", "quantity", -1),
    sortOpt("value", "Highest stock value", "stockValue", -1),
  ],
  filters: async () => [
    await categoryFilter(),
    {
      key: "level",
      allLabel: "All Levels",
      options: Object.entries(LEVEL_LABEL).map(([value, label]) => ({ value, label })),
    },
  ],
  async run(ctx) {
    const list = await productsWithStock(ctx.filters.category);
    let rows: ReportRow[] = list.map(({ p, inv }) => {
      const qty = inv?.quantity ?? 0;
      const level = levelOf(qty, p.reorderLevel);
      return {
        _id: String(p._id),
        href: `/dashboard/products/${p._id}`,
        sku: p.sku,
        name: p.name,
        category: p.category || "—",
        quantity: qty,
        reorderLevel: p.reorderLevel,
        level: LEVEL_LABEL[level],
        levelKey: level,
        tone: LEVEL_TONE[level],
        costPrice: rupees(p.costPricePaise),
        stockValue: rupees(qty * p.costPricePaise),
        lastMovement: inv?.lastMovementAt ? formatDateTime(inv.lastMovementAt) : "—",
      };
    });
    if (ctx.filters.level) rows = rows.filter((r) => r.levelKey === ctx.filters.level);
    rows = searchRows(rows, ctx.search, ["sku", "name", "category"]);
    const out = pageRows(rows, ctx);
    out.summary = [
      { label: "Units in stock", value: rows.reduce((s, r) => s + Number(r.quantity), 0), format: "number" },
      { label: "Stock value (cost)", value: rows.reduce((s, r) => s + Number(r.stockValue), 0), format: "money" },
      { label: "Low / out of stock", value: rows.filter((r) => r.levelKey !== "IN_STOCK").length, format: "number", tone: "out" },
    ];
    return out;
  },
};

export const stockTransactionReport: ReportDef = {
  meta: {
    key: "stock-transactions",
    group: "reports",
    title: "Stock Transaction Report",
    description: "Every stock movement — stock in, adjustments, order deductions and returns — with before and after",
    dateMode: "required",
    searchPlaceholder: "Search by SKU, transaction no., PO number or order no...",
  },
  permission: "report",
  columns: [
    { key: "txnNo", label: "Txn No.", format: "mono" },
    { key: "txnDate", label: "Date", format: "date" },
    { key: "type", label: "Type", format: "badge" },
    { key: "sku", label: "SKU", format: "mono" },
    { key: "product", label: "Product" },
    { key: "change", label: "Change", format: "signed", align: "right" },
    { key: "before", label: "Before", format: "number", align: "right" },
    { key: "after", label: "After", format: "number", align: "right" },
    { key: "poNumber", label: "PO No.", format: "mono" },
    { key: "reference", label: "Order / Ref", format: "mono" },
    { key: "reason", label: "Reason", hiddenByDefault: true },
    { key: "source", label: "Source", hiddenByDefault: true },
    { key: "by", label: "By", hiddenByDefault: true },
  ],
  sorts: [sortOpt("newest", "Newest first", "createdAt", -1), sortOpt("oldest", "Oldest first", "createdAt", 1)],
  filters: async () => [
    { key: "type", allLabel: "All Types", options: STOCK_TXN_TYPES.map((t) => ({ value: t, label: STOCK_TXN_LABELS[t] })) },
    {
      key: "source",
      allLabel: "All Sources",
      options: [
        { value: "manual", label: "Manual" },
        { value: "csv", label: "CSV upload" },
        { value: "order", label: "Order" },
      ],
    },
  ],
  async run(ctx) {
    const match: Filter = {
      ...dayMatch("txnDate", ctx.range),
      ...searchMatch(ctx.search, ["sku", "txnNo", "poNumber", "reference"]),
      ...(ctx.filters.type ? { type: ctx.filters.type } : {}),
      ...(ctx.filters.source ? { source: ctx.filters.source } : {}),
    };
    const { skip, limit } = window(ctx);
    const [docs, total, inOut] = await Promise.all([
      StockTransaction.find(match).sort({ [ctx.sort.field]: ctx.sort.dir }).skip(skip).limit(limit).lean(),
      StockTransaction.countDocuments(match),
      StockTransaction.aggregate<{ _id: boolean; qty: number }>([
        { $match: match },
        { $group: { _id: { $gt: ["$change", 0] }, qty: { $sum: "$change" } } },
      ]),
    ]);
    const [products, users] = await Promise.all([
      Product.find({ _id: { $in: docs.map((d) => d.product) } }).select("name").lean(),
      User.find({ _id: { $in: docs.map((d) => d.createdBy).filter(Boolean) } } as Filter).select("name").lean(),
    ]);
    const pName = new Map(products.map((p) => [String(p._id), p.name]));
    const uName = new Map(users.map((u) => [String(u._id), u.name]));
    const rows: ReportRow[] = docs.map((d) => ({
      _id: String(d._id),
      href: d.order ? `/dashboard/orders/${d.order}` : undefined,
      txnNo: d.txnNo,
      txnDate: d.txnDate,
      type: STOCK_TXN_LABELS[d.type as StockTxnType] ?? d.type,
      tone: d.change > 0 ? "success" : "danger",
      sku: d.sku,
      product: pName.get(String(d.product)) ?? "—",
      change: d.change,
      before: d.before,
      after: d.after,
      poNumber: d.poNumber || "",
      reference: d.reference || "",
      reason: d.reason || "",
      source: d.source,
      by: d.createdBy ? uName.get(String(d.createdBy)) ?? "" : "",
    }));
    const added = inOut.find((x) => x._id === true)?.qty ?? 0;
    const removed = -(inOut.find((x) => x._id === false)?.qty ?? 0);
    return {
      rows,
      total,
      summary: [
        { label: "Transactions", value: total, format: "number" },
        { label: "Units added", value: added, format: "number", tone: "in" },
        { label: "Units removed", value: removed, format: "number", tone: "out" },
      ],
    };
  },
};
