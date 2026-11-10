import "server-only";
import { newDeleteBatch, softDelete } from "../models/softDelete";
import { sellableOnChannel } from "./channelAllocation";
import { isValidObjectId, Types } from "mongoose";
import { ORDER_STATUSES, ORDER_TYPES, PAYMENT_STATUSES, type Order, type OrderType } from "@/lib/commerceTypes";
import type { Payment as PaymentRow } from "@/lib/financeTypes";
import { addDays, isDay } from "@/lib/indiaDate";
import { fromPaise, toPaise } from "@/lib/money";
import type { Option, Paginated, SessionUser } from "@/lib/types";
import type { OrderInput, OrderPaymentInput } from "@/lib/validation/order.schema";
import { Account } from "../models/Account";
import { Channel } from "../models/Channel";
import { ChannelProduct } from "../models/ChannelProduct";
import { nextCode } from "../models/Counter";
import { Customer } from "../models/Customer";
import { Inventory } from "../models/Inventory";
import { Order as OrderModel, type OrderDoc } from "../models/Order";
import { Payment } from "../models/Payment";
import { Product } from "../models/Product";
import { AppError, notFound } from "../http/errors";
import { escapeRegex, paginate, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";
import { postPayment } from "./finance/paymentCore";
import { confirmOrder } from "./orderFlow.service";

export const ORDER_FILTERS = ["orderType", "channel", "paymentStatus", "from", "to", "customer"];

/** Product the order form can add: price is the channel price (marketplace) or selling price. */
export interface OrderProductOption {
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

type PopulatedOrder = Omit<OrderDoc, "channel" | "customer" | "createdBy"> & {
  channel: { _id: Types.ObjectId; name: string; code: string } | null;
  customer: { _id: Types.ObjectId; name: string; code: string } | null;
  createdBy: { _id: Types.ObjectId; name: string } | null;
};

function toOrder(doc: PopulatedOrder): Order {
  const p = toPlain<PopulatedOrder & { _id: string }>(doc);
  return {
    _id: p._id,
    orderNo: p.orderNo,
    orderType: p.orderType,
    channel: p.channel ? { _id: String(p.channel._id), name: p.channel.name, code: p.channel.code } : null,
    orderReference: p.orderReference,
    customer: p.customer ? { _id: String(p.customer._id), name: p.customer.name, code: p.customer.code } : null,
    customerName: p.customerName,
    customerPhone: p.customerPhone,
    customerAddress: p.customerAddress,
    orderDate: p.orderDate,
    dueDate: p.dueDate,
    items: p.items.map((i) => ({
      product: String(i.product),
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      price: fromPaise(i.pricePaise),
      total: fromPaise(i.totalPaise),
    })),
    subtotal: fromPaise(p.subtotalPaise),
    discount: fromPaise(p.discountPaise),
    taxPercent: p.taxPercent,
    tax: fromPaise(p.taxPaise),
    shipping: fromPaise(p.shippingPaise ?? 0),
    total: fromPaise(p.totalPaise),
    paid: fromPaise(p.paidPaise),
    outstanding: fromPaise(p.outstandingPaise),
    paymentStatus: p.paymentStatus,
    status: p.status,
    courier: p.courier,
    trackingNumber: p.trackingNumber,
    shippedAt: p.shippedAt ? String(p.shippedAt) : undefined,
    deliveredAt: p.deliveredAt ? String(p.deliveredAt) : undefined,
    notes: p.notes,
    history: p.history.map((h) => ({ status: h.status, at: String(h.at), by: h.by, note: h.note })),
    createdBy: p.createdBy ? { _id: String(p.createdBy._id), name: p.createdBy.name } : null,
    createdAt: p.createdAt ? String(p.createdAt) : undefined,
    updatedAt: p.updatedAt ? String(p.updatedAt) : undefined,
  };
}

/** Pending-only extras the edit form needs. */
export type OrderRecord = Order & {
  upfrontPayment: number;
  upfrontPaymentMethod: string;
  upfrontPaymentRef: string;
};

function buildFilter(query: Pick<ListQuery, "search" | "status" | "filters">): Filter {
  const filter: Filter = {};
  const f = query.filters;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ orderNo: rx }, { orderReference: rx }, { customerName: rx }, { customerPhone: rx }, { trackingNumber: rx }];
  }
  if ((ORDER_STATUSES as readonly string[]).includes(query.status)) filter.status = query.status;
  if (f.orderType && (ORDER_TYPES as readonly string[]).includes(f.orderType)) filter.orderType = f.orderType;
  if (f.paymentStatus && (PAYMENT_STATUSES as readonly string[]).includes(f.paymentStatus)) filter.paymentStatus = f.paymentStatus;
  if (f.channel && isValidObjectId(f.channel)) filter.channel = new Types.ObjectId(f.channel);
  if (f.customer && isValidObjectId(f.customer)) filter.customer = new Types.ObjectId(f.customer);
  const date: Record<string, string> = {};
  if (f.from && isDay(f.from)) date.$gte = f.from;
  if (f.to && isDay(f.to)) date.$lte = f.to;
  if (Object.keys(date).length) filter.orderDate = date;
  return filter;
}

async function findOrders(filter: Filter, skip: number, limit: number) {
  const docs = await OrderModel.find(filter)
    .sort({ orderDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("channel", "name code")
    .populate("customer", "name code")
    .populate("createdBy", "name")
    .lean<PopulatedOrder[]>();
  return docs.map(toOrder);
}

export async function listOrders(query: ListQuery): Promise<Paginated<Order>> {
  const filter = buildFilter(query);
  const [items, total] = await Promise.all([
    findOrders(filter, (query.page - 1) * query.limit, query.limit),
    OrderModel.countDocuments(filter),
  ]);
  return paginate(items, total, query);
}

/** Every order matching the list filters (Excel / CSV export). */
export async function exportOrders(params: URLSearchParams): Promise<Order[]> {
  const filters: Record<string, string> = {};
  for (const k of ORDER_FILTERS) {
    const v = params.get(k)?.trim();
    if (v) filters[k] = v;
  }
  return findOrders(buildFilter({ search: (params.get("search") ?? "").trim(), status: params.get("status") ?? "", filters }), 0, 20000);
}

export async function getOrder(id: string): Promise<OrderRecord> {
  if (!isValidObjectId(id)) throw notFound("Order");
  const doc = await OrderModel.findById(id)
    .populate("channel", "name code")
    .populate("customer", "name code")
    .populate("createdBy", "name")
    .lean<PopulatedOrder>();
  if (!doc) throw notFound("Order");
  return {
    ...toOrder(doc),
    upfrontPayment: fromPaise(doc.upfrontPaymentPaise),
    upfrontPaymentMethod: doc.upfrontPaymentMethod ?? "",
    upfrontPaymentRef: doc.upfrontPaymentRef ?? "",
  };
}

/** Turns the form input into stored order fields; prices and totals are recomputed here. */
async function buildOrder(input: OrderInput) {
  const orderType = input.orderType as OrderType;
  let channel: Types.ObjectId | null = null;
  let channelName = "";
  if (orderType === "MARKETPLACE") {
    const ch = await Channel.findById(input.channel).select("name status").lean();
    if (!ch) throw new AppError("Select the marketplace", 422, { channel: "Select the marketplace" });
    if (ch.status !== "active") throw new AppError(`${ch.name} is inactive`, 422, { channel: `${ch.name} is inactive` });
    channel = ch._id;
    channelName = ch.name;
  }

  let customer: Types.ObjectId | null = null;
  let customerName = input.customerName;
  let customerPhone = input.customerPhone;
  let customerAddress = input.customerAddress;
  let dueDate = input.dueDate;
  if (input.customer && orderType !== "MARKETPLACE") {
    const c = await Customer.findById(input.customer).lean();
    const want = orderType === "DISTRIBUTOR" ? "distributor" : "local";
    if (!c || c.kind !== want) throw new AppError(`Select a ${want === "distributor" ? "distributor" : "customer"}`, 422, { customer: "Not found" });
    customer = c._id;
    customerName = c.name;
    customerPhone = customerPhone || c.phone || "";
    customerAddress = customerAddress || c.address || "";
    if (!dueDate && c.creditDays > 0) dueDate = addDays(input.orderDate, c.creditDays);
  }
  if (orderType === "MARKETPLACE" && !customerName) customerName = channelName;

  const ids = [...new Set(input.items.map((i) => i.product))];
  const products = await Product.find({ _id: { $in: ids } }).select("sku name status hasVariants").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) throw new AppError("A selected product no longer exists", 422);
    if (p.status !== "active") throw new AppError(`${p.sku} is inactive`, 422);
    if (p.hasVariants) throw new AppError(`${p.sku} has variants — choose one of its variants`, 422);
  }
  if (channel) {
    const listed = await ChannelProduct.find({ channel, product: { $in: ids } }).select("product").lean();
    const set = new Set(listed.map((l) => String(l.product)));
    const missing = ids.filter((id) => !set.has(id)).map((id) => byId.get(id)!.sku);
    if (missing.length) throw new AppError(`Not assigned to ${channelName}: ${missing.join(", ")}`, 422);
  }

  const items = input.items.map((i) => {
    const p = byId.get(i.product)!;
    const pricePaise = toPaise(i.price);
    return { product: p._id, sku: p.sku, name: p.name, quantity: i.quantity, pricePaise, totalPaise: pricePaise * i.quantity };
  });
  const subtotalPaise = items.reduce((s, i) => s + i.totalPaise, 0);
  const discountPaise = toPaise(input.discount);
  if (discountPaise > subtotalPaise) throw new AppError("Discount cannot be more than the subtotal", 422, { discount: "More than the subtotal" });
  const taxPercent = Number(input.taxPercent) || 0;
  const taxPaise = Math.round(((subtotalPaise - discountPaise) * taxPercent) / 100);
  const shippingPaise = toPaise(input.shipping);
  const totalPaise = subtotalPaise - discountPaise + taxPaise + shippingPaise;
  const upfrontPaymentPaise = toPaise(input.upfrontPayment);
  if (upfrontPaymentPaise > totalPaise) {
    throw new AppError("Amount paid cannot be more than the order total", 422, { upfrontPayment: "More than the order total" });
  }

  return {
    orderType,
    channel,
    orderReference: input.orderReference,
    customer,
    customerName,
    customerPhone,
    customerAddress,
    orderDate: input.orderDate,
    dueDate,
    items,
    subtotalPaise,
    discountPaise,
    taxPercent,
    taxPaise,
    shippingPaise,
    totalPaise,
    // Pending: nothing is owed yet; settlement takes over once confirmed
    paidPaise: 0,
    outstandingPaise: totalPaise,
    paymentStatus: "UNPAID" as const,
    upfrontPaymentPaise,
    upfrontPaymentMethod: upfrontPaymentPaise > 0 ? input.upfrontPaymentMethod : "",
    upfrontPaymentRef: upfrontPaymentPaise > 0 ? input.upfrontPaymentRef : "",
    notes: input.notes,
  };
}

export interface SaveOrderResult {
  order: OrderRecord;
  /** Set when "Save & Confirm" saved the order but confirming failed (e.g. not enough stock) */
  confirmError?: string;
}

async function maybeConfirm(id: string, confirm: boolean, user: SessionUser): Promise<SaveOrderResult> {
  let confirmError: string | undefined;
  if (confirm) {
    try {
      await confirmOrder(id, user);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      confirmError = error.message;
    }
  }
  return { order: await getOrder(id), confirmError };
}

export async function createOrder(input: OrderInput, user: SessionUser): Promise<SaveOrderResult> {
  const fields = await buildOrder(input);
  const doc = await OrderModel.create({
    ...fields,
    orderNo: await nextCode("order", "ORD", 5),
    status: "PENDING",
    history: [{ status: "PENDING", at: new Date(), by: user.name, note: "Order created" }],
    createdBy: user._id,
  });
  return maybeConfirm(String(doc._id), Boolean(input.confirm), user);
}

export async function updateOrder(id: string, input: OrderInput, user: SessionUser): Promise<SaveOrderResult> {
  if (!isValidObjectId(id)) throw notFound("Order");
  const fields = await buildOrder(input);
  const res = await OrderModel.updateOne({ _id: id, status: "PENDING" }, { $set: fields }, { runValidators: true });
  if (!res.matchedCount) {
    if (!(await OrderModel.exists({ _id: id }))) throw notFound("Order");
    throw new AppError("Only pending orders can be edited", 409);
  }
  return maybeConfirm(id, Boolean(input.confirm), user);
}

export async function deleteOrder(id: string, userId?: string): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Order");
  const deleted = await softDelete(OrderModel, { _id: id, status: "PENDING" }, { batch: newDeleteBatch(), userId, primary: true });
  if (!deleted) {
    if (!(await OrderModel.exists({ _id: id }))) throw notFound("Order");
    throw new AppError("Only pending orders can be deleted. Cancel the order instead.", 409);
  }
}

/** Products the order form may add, with price and available stock. */
export async function listOrderProductOptions(orderType: string, channelId?: string): Promise<OrderProductOption[]> {
  let rows: { _id: Types.ObjectId; sku: string; name: string; pricePaise: number; allocatedQty?: number | null }[];
  if (orderType === "MARKETPLACE") {
    if (!channelId || !isValidObjectId(channelId)) return [];
    const listed = await ChannelProduct.find({ channel: channelId })
      .populate<{ product: { _id: Types.ObjectId; sku: string; name: string; status: string; sellingPricePaise: number } | null }>(
        "product",
        "sku name status sellingPricePaise"
      )
      .lean();
    rows = listed
      .filter((l) => l.product && l.product.status === "active")
      .map((l) => ({
        _id: l.product!._id,
        sku: l.product!.sku,
        name: l.product!.name,
        pricePaise: l.channelPricePaise || l.product!.sellingPricePaise,
        allocatedQty: l.allocatedQty ?? null,
      }));
  } else {
    const products = await Product.find({ status: "active", hasVariants: { $ne: true } }).select("sku name sellingPricePaise").lean();
    rows = products.map((p) => ({ _id: p._id, sku: p.sku, name: p.name, pricePaise: p.sellingPricePaise }));
  }
  const stock = await Inventory.find({ product: { $in: rows.map((r) => r._id) } }).select("product quantity").lean();
  const qty = new Map(stock.map((s) => [String(s.product), s.quantity]));
  if (orderType === "MARKETPLACE" && channelId) {
    // Cap by what is left of the quantity assigned to this marketplace
    const sellable = await sellableOnChannel(
      channelId,
      rows.map((r) => ({ productId: String(r._id), stock: qty.get(String(r._id)) ?? 0, allocatedQty: r.allocatedQty }))
    );
    for (const [id, n] of sellable) qty.set(id, n);
  }
  return rows
    .map((r) => ({ productId: String(r._id), sku: r.sku, name: r.name, price: fromPaise(r.pricePaise), stock: qty.get(String(r._id)) ?? 0 }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

/** Active marketplaces for the order form. */
export async function listActiveChannelOptions(): Promise<Option[]> {
  const docs = await Channel.find({ status: "active" }).sort({ name: 1 }).select("name code").lean();
  return docs.map((d) => ({ value: String(d._id), label: `${d.name} (${d.code})` }));
}

/** All marketplaces (incl. inactive) for list filters. */
export async function listChannelFilterOptions(): Promise<Option[]> {
  const docs = await Channel.find({}).sort({ name: 1 }).select("name").lean();
  return docs.map((d) => ({ value: String(d._id), label: d.name }));
}

export async function listAccountOptions(): Promise<Option[]> {
  const docs = await Account.find({ status: "active" }).sort({ type: 1, name: 1 }).select("name type").lean();
  return docs.map((d) => ({ value: String(d._id), label: `${d.name} (${d.type === "CASH" ? "Cash" : "Bank"})` }));
}

/** Payments received / refunds made against one order. */
export async function listOrderPayments(orderId: string): Promise<PaymentRow[]> {
  if (!isValidObjectId(orderId)) return [];
  const docs = await Payment.find({ referenceType: "ORDER", referenceId: orderId })
    .sort({ paymentDate: 1, createdAt: 1 })
    .populate("account", "name code")
    .populate("createdBy", "name")
    .lean();
  return docs.map((d) => {
    const p = toPlain<Record<string, unknown>>(d);
    return {
      _id: String(d._id),
      paymentNo: d.paymentNo,
      paymentDate: d.paymentDate,
      direction: d.direction,
      referenceType: d.referenceType,
      referenceId: d.referenceId ? String(d.referenceId) : null,
      referenceLabel: d.referenceLabel,
      partyName: d.partyName,
      amount: fromPaise(d.amountPaise),
      method: d.method,
      account: (p.account as PaymentRow["account"]) ?? null,
      transactionRef: d.transactionRef,
      notes: d.notes,
      createdBy: (p.createdBy as PaymentRow["createdBy"]) ?? null,
      createdAt: p.createdAt as string,
    };
  });
}

export async function recordOrderPayment(orderId: string, input: OrderPaymentInput, user: SessionUser) {
  if (!isValidObjectId(orderId)) throw notFound("Order");
  await postPayment({
    paymentDate: input.paymentDate,
    direction: input.direction === "MADE" ? "MADE" : "RECEIVED",
    referenceType: "ORDER",
    referenceId: orderId,
    amountPaise: toPaise(input.amount),
    method: input.method as PaymentRow["method"],
    accountId: input.accountId || null,
    transactionRef: input.transactionRef,
    notes: input.notes,
    userId: user._id,
  });
  return getOrder(orderId);
}
