import "server-only";
import type { Filter } from "../../http/query";
import { isValidObjectId, Types, type PipelineStage } from "mongoose";
import {
  ORDER_STATUSES,
  ORDER_TYPE_LABELS,
  ORDER_TYPES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  SALE_STATUSES,
  type OrderStatus,
  type OrderType,
  type PaymentStatus,
} from "@/lib/commerceTypes";
import type { ReportRow } from "@/lib/reportTypes";
import { Channel } from "../../models/Channel";
import { Customer } from "../../models/Customer";
import { Order } from "../../models/Order";
import { dayMatch, rupees, searchMatch, sortOpt, window, type ReportDef } from "./engine";
import { saleOrderMatch } from "./metrics";

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export const STATUS_TONE: Record<OrderStatus, ReportRow["tone"]> = {
  PENDING: "neutral",
  CONFIRMED: "info",
  SHIPPED: "brand",
  DELIVERED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  RETURNED: "warning",
};

export async function channelFilter() {
  const channels = await Channel.find().sort({ name: 1 }).select("name").lean();
  return { key: "channel", allLabel: "All Marketplaces", options: channels.map((c) => ({ value: String(c._id), label: c.name })) };
}

async function distributorFilter() {
  const list = await Customer.find({ kind: "distributor" }).sort({ name: 1 }).select("name").lean();
  return { key: "customer", allLabel: "All Distributors", options: list.map((c) => ({ value: String(c._id), label: c.name })) };
}

const channelLookup: PipelineStage.FacetPipelineStage[] = [
  { $lookup: { from: "channels", localField: "channel", foreignField: "_id", as: "ch", pipeline: [{ $project: { name: 1 } }] } },
  { $set: { channelName: { $ifNull: [{ $first: "$ch.name" }, ""] } } },
];

/** Party shown on a row: marketplace name, else the customer / distributor name. */
const partyOf = (o: { channelName?: string; customerName?: string }) => o.channelName || o.customerName || "Walk-in";

export const orderReport: ReportDef = {
  meta: {
    key: "orders",
    group: "reports",
    title: "Order Report",
    description: "All orders with type, status, totals and payment position",
    dateMode: "required",
    searchPlaceholder: "Search by order no., reference or customer...",
  },
  permission: "report",
  columns: [
    { key: "orderNo", label: "Order No.", format: "mono" },
    { key: "orderDate", label: "Date", format: "date" },
    { key: "orderType", label: "Type" },
    { key: "party", label: "Marketplace / Customer" },
    { key: "orderReference", label: "Reference", format: "mono", hiddenByDefault: true },
    { key: "items", label: "Items", format: "number", align: "right" },
    { key: "total", label: "Total", format: "money", align: "right" },
    { key: "paid", label: "Paid", format: "money", align: "right" },
    { key: "outstanding", label: "Outstanding", format: "money", align: "right" },
    { key: "paymentStatus", label: "Payment", align: "center" },
    { key: "status", label: "Status", format: "badge", align: "center" },
    { key: "trackingNumber", label: "Tracking No.", format: "mono", hiddenByDefault: true },
  ],
  sorts: [
    sortOpt("newest", "Newest first", "createdAt", -1),
    sortOpt("oldest", "Oldest first", "createdAt", 1),
    sortOpt("total", "Highest total", "totalPaise", -1),
    sortOpt("outstanding", "Highest outstanding", "outstandingPaise", -1),
  ],
  filters: async () => [
    { key: "orderType", allLabel: "All Order Types", options: ORDER_TYPES.map((t) => ({ value: t, label: ORDER_TYPE_LABELS[t] })) },
    { key: "orderStatus", allLabel: "All Statuses", options: ORDER_STATUSES.map((s) => ({ value: s, label: title(s) })) },
    { key: "paymentStatus", allLabel: "All Payments", options: PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })) },
    await channelFilter(),
  ],
  async run(ctx) {
    const f = ctx.filters;
    const match: Filter = {
      ...dayMatch("orderDate", ctx.range),
      ...searchMatch(ctx.search, ["orderNo", "orderReference", "customerName", "trackingNumber"]),
      ...(f.orderType ? { orderType: f.orderType } : {}),
      ...(f.orderStatus ? { status: f.orderStatus } : {}),
      ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : {}),
      ...(f.channel ? { channel: toId(f.channel) } : {}),
    };
    const { skip, limit } = window(ctx);
    const [docs, total, totals] = await Promise.all([
      Order.aggregate([{ $match: match }, { $sort: { [ctx.sort.field]: ctx.sort.dir } }, { $skip: skip }, { $limit: limit }, ...channelLookup]),
      Order.countDocuments(match),
      Order.aggregate<{ total: number; outstanding: number }>([
        { $match: { ...match, status: { $in: SALE_STATUSES } } },
        { $group: { _id: null, total: { $sum: "$totalPaise" }, outstanding: { $sum: "$outstandingPaise" } } },
      ]),
    ]);
    const rows: ReportRow[] = docs.map((o) => ({
      _id: String(o._id),
      href: `/dashboard/orders/${o._id}`,
      orderNo: o.orderNo,
      orderDate: o.orderDate,
      orderType: ORDER_TYPE_LABELS[o.orderType as OrderType],
      party: partyOf(o),
      orderReference: o.orderReference || "",
      items: (o.items as unknown[]).length,
      total: rupees(o.totalPaise),
      paid: rupees(o.paidPaise),
      outstanding: rupees(o.outstandingPaise),
      paymentStatus: PAYMENT_STATUS_LABELS[o.paymentStatus as PaymentStatus],
      status: title(o.status),
      tone: STATUS_TONE[o.status as OrderStatus],
      trackingNumber: o.trackingNumber || "",
    }));
    return {
      rows,
      total,
      summary: [
        { label: "Orders", value: total, format: "number" },
        { label: "Sales value (confirmed+)", value: rupees(totals[0]?.total), format: "money", tone: "in" },
        { label: "Outstanding", value: rupees(totals[0]?.outstanding), format: "money", tone: "out" },
      ],
    };
  },
};

export const toId = (id: string) => (isValidObjectId(id) ? new Types.ObjectId(id) : null);

/** Line-level sales register for one order type (sold orders only). */
function salesRegister(type: OrderType, key: string, titleText: string, description: string): ReportDef {
  const partyLabel = type === "MARKETPLACE" ? "Marketplace" : type === "DISTRIBUTOR" ? "Distributor" : "Customer";
  return {
    meta: {
      key,
      group: "reports",
      title: titleText,
      description,
      dateMode: "required",
      searchPlaceholder: "Search by SKU, product, order no. or customer...",
    },
    permission: "report",
    columns: [
      { key: "orderDate", label: "Date", format: "date" },
      { key: "orderNo", label: "Order No.", format: "mono" },
      { key: "party", label: partyLabel },
      { key: "orderReference", label: "Reference", format: "mono", hiddenByDefault: type !== "MARKETPLACE" },
      { key: "sku", label: "SKU", format: "mono" },
      { key: "name", label: "Product" },
      { key: "quantity", label: "Qty", format: "number", align: "right" },
      { key: "price", label: "Price", format: "money", align: "right" },
      { key: "lineTotal", label: "Line Total", format: "money", align: "right" },
      { key: "status", label: "Status", format: "badge", align: "center" },
    ],
    sorts: [
      sortOpt("newest", "Newest first", "createdAt", -1),
      sortOpt("oldest", "Oldest first", "createdAt", 1),
      sortOpt("value", "Highest line total", "items.totalPaise", -1),
      sortOpt("qty", "Highest quantity", "items.quantity", -1),
    ],
    filters: async () => (type === "MARKETPLACE" ? [await channelFilter()] : type === "DISTRIBUTOR" ? [await distributorFilter()] : []),
    async run(ctx) {
      const match: Filter = {
        ...saleOrderMatch(ctx.range, type),
        ...(ctx.filters.channel ? { channel: toId(ctx.filters.channel) } : {}),
        ...(ctx.filters.customer ? { customer: toId(ctx.filters.customer) } : {}),
      };
      const lineSearch = searchMatch(ctx.search, ["items.sku", "items.name", "orderNo", "customerName", "orderReference"]);
      const { skip, limit } = window(ctx);
      const [res] = await Order.aggregate<{
        rows: Record<string, never>[];
        meta: { total: number; qty: number; value: number }[];
      }>([
        { $match: match },
        { $unwind: "$items" },
        { $match: lineSearch },
        {
          $facet: {
            rows: [{ $sort: { [ctx.sort.field]: ctx.sort.dir, _id: -1 } }, { $skip: skip }, { $limit: limit }, ...channelLookup],
            meta: [{ $group: { _id: null, total: { $sum: 1 }, qty: { $sum: "$items.quantity" }, value: { $sum: "$items.totalPaise" } } }],
          },
        },
      ]);
      type Line = { _id: string; orderNo: string; orderDate: string; orderReference?: string; customerName?: string; channelName?: string; status: OrderStatus; items: { sku: string; name: string; quantity: number; pricePaise: number; totalPaise: number } };
      const rows: ReportRow[] = (res?.rows as unknown as Line[]).map((o, i) => ({
        _id: `${o._id}-${i}-${o.items.sku}`,
        href: `/dashboard/orders/${o._id}`,
        orderDate: o.orderDate,
        orderNo: o.orderNo,
        party: partyOf(o),
        orderReference: o.orderReference || "",
        sku: o.items.sku,
        name: o.items.name,
        quantity: o.items.quantity,
        price: rupees(o.items.pricePaise),
        lineTotal: rupees(o.items.totalPaise),
        status: title(o.status),
        tone: STATUS_TONE[o.status],
      }));
      const meta = res?.meta[0];
      return {
        rows,
        total: meta?.total ?? 0,
        summary: [
          { label: "Lines", value: meta?.total ?? 0, format: "number" },
          { label: "Units sold", value: meta?.qty ?? 0, format: "number" },
          { label: "Sales value", value: rupees(meta?.value), format: "money", tone: "in" },
        ],
      };
    },
  };
}

export const marketplaceSalesReport = salesRegister(
  "MARKETPLACE",
  "marketplace-sales",
  "Marketplace Sales Report",
  "Product-wise sales on each marketplace (confirmed, shipped, delivered and completed orders)"
);
export const localSalesReport = salesRegister("LOCAL", "local-sales", "Local Sales Report", "Product-wise local sales (confirmed, shipped, delivered and completed orders)");
export const distributorSalesReport = salesRegister(
  "DISTRIBUTOR",
  "distributor-sales",
  "Distributor Sales Report",
  "Product-wise sales to each distributor (confirmed, shipped, delivered and completed orders)"
);
