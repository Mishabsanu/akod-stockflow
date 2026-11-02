import "server-only";
import { ORDER_TYPE_LABELS, ORDER_TYPES, STOCK_TXN_LABELS, type OrderStatus, type OrderType, type PaymentStatus, type StockTxnType } from "@/lib/commerceTypes";
import { bucketKeys, bucketLabel, bucketOf } from "@/lib/periods";
import { Inventory } from "../models/Inventory";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { StockTransaction } from "../models/StockTransaction";
import { rupees } from "./reports/engine";
import * as m from "./reports/metrics";

export interface DashboardKpis {
  products: number;
  activeProducts: number;
  stockUnits: number;
  lowStock: number;
  orders: number;
  salesCount: number;
  salesValue: number;
  revenue: number;
  expenses: number;
  cogs: number;
  netProfit: number;
  receivables: number;
  payables: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  MARKETPLACE: number;
  LOCAL: number;
  DISTRIBUTOR: number;
  revenue: number;
}

export interface DashboardData {
  range: m.Range;
  unit: "day" | "month";
  orderType: OrderType | "";
  kpis: DashboardKpis;
  trend: TrendPoint[];
  byType: { type: OrderType; label: string; count: number; value: number }[];
  byChannel: { _id: string; name: string; count: number; units: number; value: number }[];
  /** Best sellers in the period by units sold (confirmed / processing / completed orders) */
  topProducts: { _id: string; sku: string; name: string; units: number; value: number; orders: number }[];
  recentOrders: {
    _id: string;
    orderNo: string;
    orderType: OrderType;
    party: string;
    orderDate: string;
    total: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
  }[];
  recentStock: {
    _id: string;
    txnNo: string;
    type: StockTxnType;
    typeLabel: string;
    sku: string;
    change: number;
    after: number;
    reference: string;
    txnDate: string;
  }[];
}

async function stockFigures() {
  const [units, low] = await Promise.all([
    Inventory.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$quantity" } } }]),
    // Active products at or below their reorder level (no inventory row = 0 stock)
    Product.aggregate<{ n: number }>([
      { $match: { status: "active" } },
      { $lookup: { from: "inventories", localField: "_id", foreignField: "product", as: "inv", pipeline: [{ $project: { quantity: 1 } }] } },
      { $match: { $expr: { $lte: [{ $ifNull: [{ $first: "$inv.quantity" }, 0] }, "$reorderLevel"] } } },
      { $count: "n" },
    ]),
  ]);
  return { stockUnits: units[0]?.total ?? 0, lowStock: low[0]?.n ?? 0 };
}

export async function getDashboard(range: m.Range, orderType: OrderType | ""): Promise<DashboardData> {
  const typeMatch = orderType ? { orderType } : {};
  const [products, activeProducts, stock, orders, sales, revenue, expenses, cogs, receivables, payables, salesSeries, revenueSeries, byType, byChannel, recent, recentStock, topProducts] =
    await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: "active" }),
      stockFigures(),
      Order.countDocuments({ orderDate: { $gte: range.from, $lte: range.to }, ...typeMatch }),
      m.sales(range, orderType),
      m.revenue(range, orderType),
      m.expenses(range),
      m.cogs(m.saleOrderMatch(range, orderType)),
      m.receivables(orderType),
      m.payables(),
      m.salesSeries(range, orderType),
      m.revenueSeries(range, orderType),
      m.salesByType(range),
      Order.aggregate<{ _id: unknown; name: string; count: number; units: number; value: number }>([
        { $match: m.saleOrderMatch(range, "MARKETPLACE") },
        { $group: { _id: "$channel", count: { $sum: 1 }, value: { $sum: "$totalPaise" }, units: { $sum: { $sum: "$items.quantity" } } } },
        { $lookup: { from: "channels", localField: "_id", foreignField: "_id", as: "ch", pipeline: [{ $project: { name: 1 } }] } },
        { $set: { name: { $ifNull: [{ $first: "$ch.name" }, "Unknown"] } } },
        { $sort: { value: -1 } },
        { $limit: 8 },
      ]),
      Order.aggregate([
        { $match: typeMatch },
        { $sort: { createdAt: -1 } },
        { $limit: 8 },
        { $lookup: { from: "channels", localField: "channel", foreignField: "_id", as: "ch", pipeline: [{ $project: { name: 1 } }] } },
        { $project: { orderNo: 1, orderType: 1, orderDate: 1, totalPaise: 1, status: 1, paymentStatus: 1, customerName: 1, channelName: { $first: "$ch.name" } } },
      ]),
      StockTransaction.find().sort({ createdAt: -1 }).limit(8).lean(),
      Order.aggregate<{ _id: unknown; sku: string; name: string; units: number; value: number; orders: number }>([
        { $match: m.saleOrderMatch(range, orderType) },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            sku: { $last: "$items.sku" },
            name: { $last: "$items.name" },
            units: { $sum: "$items.quantity" },
            value: { $sum: "$items.totalPaise" },
            orderIds: { $addToSet: "$_id" },
          },
        },
        { $project: { sku: 1, name: 1, units: 1, value: 1, orders: { $size: "$orderIds" } } },
        { $sort: { units: -1, value: -1 } },
        { $limit: 10 },
      ]),
    ]);

  const trend: TrendPoint[] = bucketKeys(range.from, range.to).map((k) => ({
    key: k,
    label: bucketLabel(k),
    MARKETPLACE: rupees(salesSeries.get(`${k}|MARKETPLACE`)),
    LOCAL: rupees(salesSeries.get(`${k}|LOCAL`)),
    DISTRIBUTOR: rupees(salesSeries.get(`${k}|DISTRIBUTOR`)),
    revenue: rupees(revenueSeries.get(k)),
  }));

  return {
    range,
    unit: bucketOf(range.from, range.to),
    orderType,
    kpis: {
      products,
      activeProducts,
      ...stock,
      orders,
      salesCount: sales.count,
      salesValue: rupees(sales.total),
      revenue: rupees(revenue.total),
      expenses: rupees(expenses.total),
      cogs: rupees(cogs),
      netProfit: rupees(revenue.total - cogs - expenses.total),
      receivables: rupees(receivables.total),
      payables: rupees(payables.total),
    },
    trend,
    byType: ORDER_TYPES.map((t) => ({ type: t, label: ORDER_TYPE_LABELS[t], count: byType.get(t)?.count ?? 0, value: rupees(byType.get(t)?.total) })),
    byChannel: byChannel.map((c) => ({ _id: String(c._id), name: c.name, count: c.count, units: c.units, value: rupees(c.value) })),
    topProducts: topProducts.map((p) => ({ _id: String(p._id), sku: p.sku, name: p.name, units: p.units, value: rupees(p.value), orders: p.orders })),
    recentOrders: recent.map((o) => ({
      _id: String(o._id),
      orderNo: o.orderNo,
      orderType: o.orderType,
      party: o.orderType === "MARKETPLACE" ? o.channelName || "Marketplace" : o.customerName || "Walk-in",
      orderDate: o.orderDate,
      total: rupees(o.totalPaise),
      status: o.status,
      paymentStatus: o.paymentStatus,
    })),
    recentStock: recentStock.map((t) => ({
      _id: String(t._id),
      txnNo: t.txnNo,
      type: t.type,
      typeLabel: STOCK_TXN_LABELS[t.type] ?? t.type,
      sku: t.sku,
      change: t.change,
      after: t.after,
      reference: t.poNumber ? `PO ${t.poNumber}` : t.reference || "",
      txnDate: t.txnDate,
    })),
  };
}
