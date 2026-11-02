import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import { ORDER_TRANSITIONS, type OrderStatus, type OrderType } from "@/lib/commerceTypes";
import type { IncomeCategory } from "@/lib/financeTypes";
import { todayIST } from "@/lib/indiaDate";
import type { SessionUser } from "@/lib/types";
import { Channel } from "../models/Channel";
import { ChannelProduct } from "../models/ChannelProduct";
import { nextCode } from "../models/Counter";
import { FinanceTransaction } from "../models/FinanceTransaction";
import { Inventory } from "../models/Inventory";
import { Order, type OrderDoc } from "../models/Order";
import { Product } from "../models/Product";
import { StockTransaction } from "../models/StockTransaction";
import { AppError, notFound } from "../http/errors";
import { postPayment } from "./finance/paymentCore";
import { recomputeOrder } from "./finance/settlement";
import { moveStock } from "./stock.service";

export const INCOME_CATEGORY_FOR: Record<OrderType, IncomeCategory> = {
  MARKETPLACE: "MARKETPLACE_SALES",
  LOCAL: "LOCAL_SALES",
  DISTRIBUTOR: "DISTRIBUTOR_SALES",
};

export interface StatusChangeInput {
  status: OrderStatus;
  note?: string;
  courier?: string;
  trackingNumber?: string;
}

const event = (status: OrderStatus, user: SessionUser, note = "") => ({ status, at: new Date(), by: user.name, note });

async function loadOrder(id: string): Promise<OrderDoc> {
  if (!isValidObjectId(id)) throw notFound("Order");
  const order = await Order.findById(id).lean<OrderDoc>();
  if (!order) throw notFound("Order");
  return order;
}

/**
 * Moves the order only if it is still in `from` — two people clicking at once cannot both
 * confirm (and double-deduct) the same order.
 */
async function claim(order: OrderDoc, to: OrderStatus, user: SessionUser, note: string, extra: Record<string, unknown> = {}) {
  const res = await Order.updateOne(
    { _id: order._id, status: order.status },
    { $set: { status: to, ...extra }, $push: { history: event(to, user, note) } }
  );
  if (res.modifiedCount !== 1) throw new AppError("This order was changed by someone else. Refresh and try again.", 409);
}

/** Checks every line can be sold before anything is deducted. */
async function checkSellable(order: OrderDoc): Promise<void> {
  if (!order.items.length) throw new AppError("Add at least one product before confirming", 422);
  const ids = order.items.map((i) => i.product);
  const active = await Product.countDocuments({ _id: { $in: ids }, status: "active" });
  if (active !== new Set(ids.map(String)).size) throw new AppError("This order has an inactive product. Remove it or activate the product.", 409);
  if (order.orderType === "MARKETPLACE") {
    const channel = order.channel ? await Channel.findById(order.channel).select("status name").lean() : null;
    if (!channel) throw new AppError("Select the marketplace for this order", 422);
    if (channel.status !== "active") throw new AppError(`${channel.name} is inactive`, 409);
    const listed = await ChannelProduct.countDocuments({ channel: order.channel, product: { $in: ids } });
    if (listed !== new Set(ids.map(String)).size) throw new AppError(`Some products are no longer assigned to ${channel.name}`, 409);
  }
  // Same product on two lines: check the combined quantity
  const need = new Map<string, { sku: string; qty: number }>();
  for (const i of order.items) {
    const k = String(i.product);
    need.set(k, { sku: i.sku, qty: (need.get(k)?.qty ?? 0) + i.quantity });
  }
  const stock = await Inventory.find({ product: { $in: ids } }).select("product quantity").lean();
  const have = new Map(stock.map((s) => [String(s.product), s.quantity]));
  const short = [...need.entries()]
    .filter(([id, n]) => (have.get(id) ?? 0) < n.qty)
    .map(([id, n]) => `${n.sku} (need ${n.qty}, have ${have.get(id) ?? 0})`);
  if (short.length) throw new AppError(`Not enough stock: ${short.join(", ")}`, 409);
}

/** Undo deductions made so far when a later line fails (no history rows left behind). */
async function rollback(moves: { product: Types.ObjectId; qty: number; txnId: Types.ObjectId }[]) {
  for (const m of moves) {
    await Inventory.updateOne({ product: m.product }, { $inc: { quantity: m.qty } });
    await StockTransaction.deleteOne({ _id: m.txnId });
  }
}

/** DRAFT → CONFIRMED: validate stock, deduct it, book the income, post any upfront payment. */
export async function confirmOrder(id: string, user: SessionUser, note = ""): Promise<void> {
  const order = await loadOrder(id);
  if (order.status !== "DRAFT") throw new AppError("Only draft orders can be confirmed", 409);
  await checkSellable(order);
  await claim(order, "CONFIRMED", user, note, { confirmedAt: new Date() });

  const done: { product: Types.ObjectId; qty: number; txnId: Types.ObjectId }[] = [];
  try {
    for (const item of order.items) {
      const txn = await moveStock({
        product: item.product,
        sku: item.sku,
        change: -item.quantity,
        type: "ORDER_OUT",
        txnDate: todayIST(),
        reference: order.orderNo,
        order: order._id,
        source: "order",
        userId: user._id,
      });
      done.push({ product: item.product, qty: item.quantity, txnId: txn._id });
    }
  } catch (error) {
    await rollback(done);
    await Order.updateOne(
      { _id: order._id },
      { $set: { status: "DRAFT", confirmedAt: null }, $pop: { history: 1 } }
    );
    throw error;
  }

  await FinanceTransaction.create({
    txnNo: await nextCode("income", "INC", 5),
    txnDate: order.orderDate,
    category: INCOME_CATEGORY_FOR[order.orderType],
    order: order._id,
    channel: order.channel ?? null,
    description: `Order ${order.orderNo}${order.customerName ? ` — ${order.customerName}` : ""}`,
    amountPaise: order.totalPaise,
    source: "ORDER",
    status: "ACTIVE",
    createdBy: user._id,
  });
  await recomputeOrder(order._id);

  if (order.upfrontPaymentPaise > 0 && order.upfrontPaymentMethod) {
    await postPayment({
      paymentDate: order.orderDate,
      direction: "RECEIVED",
      referenceType: "ORDER",
      referenceId: order._id,
      amountPaise: Math.min(order.upfrontPaymentPaise, order.totalPaise),
      method: order.upfrontPaymentMethod,
      transactionRef: order.upfrontPaymentRef ?? "",
      notes: "Paid with the order",
      userId: user._id,
    });
  }
}

/** Puts every line back into stock and reverses the order income (cancel / return). */
async function reverseSale(order: OrderDoc, kind: "ORDER_CANCEL" | "ORDER_RETURN", user: SessionUser, note: string) {
  for (const item of order.items) {
    await moveStock({
      product: item.product,
      sku: item.sku,
      change: item.quantity,
      type: kind,
      txnDate: todayIST(),
      reference: order.orderNo,
      order: order._id,
      reason: note,
      source: "order",
      userId: user._id,
    });
  }
  await FinanceTransaction.updateMany(
    { order: order._id, source: "ORDER", status: "ACTIVE" },
    { $set: { status: "REVERSED", reversedAt: new Date() } }
  );
}

/** Any allowed status move (see ORDER_TRANSITIONS). */
export async function changeOrderStatus(id: string, input: StatusChangeInput, user: SessionUser): Promise<void> {
  const order = await loadOrder(id);
  const to = input.status;
  if (!ORDER_TRANSITIONS[order.status].includes(to)) {
    throw new AppError(`An order that is ${order.status.toLowerCase()} cannot be moved to ${to.toLowerCase()}`, 409);
  }
  const note = input.note?.trim() ?? "";

  if (to === "CONFIRMED") return confirmOrder(id, user, note);

  if (to === "CANCELLED") {
    await claim(order, "CANCELLED", user, note);
    if (order.status !== "DRAFT") await reverseSale(order, "ORDER_CANCEL", user, note || "Order cancelled");
  } else if (to === "RETURNED") {
    await claim(order, "RETURNED", user, note);
    await reverseSale(order, "ORDER_RETURN", user, note || "Order returned");
  } else {
    const shipment: Record<string, unknown> = {};
    if (input.courier !== undefined) shipment.courier = input.courier.trim();
    if (input.trackingNumber !== undefined) {
      shipment.trackingNumber = input.trackingNumber.trim();
      if (input.trackingNumber.trim() && !order.shippedAt) shipment.shippedAt = new Date();
    }
    await claim(order, to, user, note, shipment);
  }
  await recomputeOrder(order._id);
}

/**
 * Saves courier / tracking number. Adding a tracking number to a confirmed order moves it to
 * Processing (shipped), as the user asked: "once tracking is updated, update the status".
 */
export async function updateShipment(id: string, input: { courier: string; trackingNumber: string }, user: SessionUser) {
  const order = await loadOrder(id);
  if (!["CONFIRMED", "PROCESSING", "COMPLETED"].includes(order.status)) {
    throw new AppError("Tracking can be added only to confirmed, processing or completed orders", 409);
  }
  const trackingNumber = input.trackingNumber.trim();
  const set: Record<string, unknown> = { courier: input.courier.trim(), trackingNumber };
  if (trackingNumber && !order.shippedAt) set.shippedAt = new Date();
  if (order.status === "CONFIRMED" && trackingNumber) {
    await claim(order, "PROCESSING", user, `Shipped${set.courier ? ` via ${set.courier}` : ""} — tracking ${trackingNumber}`, set);
  } else {
    await Order.updateOne({ _id: order._id }, { $set: set });
  }
}
