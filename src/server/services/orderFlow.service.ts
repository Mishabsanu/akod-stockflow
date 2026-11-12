import "server-only";
import { assertWithinAllocation } from "./channelAllocation";
import { isValidObjectId, type Types } from "mongoose";
import { ORDER_TRANSITIONS, SALE_STATUSES, type OrderStatus, type OrderType } from "@/lib/commerceTypes";
import type { IncomeCategory } from "@/lib/financeTypes";
import { todayIST } from "@/lib/indiaDate";
import type { SessionUser } from "@/lib/types";
import { Channel } from "../models/Channel";
import { activeCategoryFilter } from "./categoryStatus";
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
  const active = await Product.countDocuments({ _id: { $in: ids }, status: "active", ...(await activeCategoryFilter()) });
  if (active !== new Set(ids.map(String)).size) {
    throw new AppError("This order has an inactive product or a product in an inactive category. Remove it or activate it.", 409);
  }
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
  if (order.orderType === "MARKETPLACE" && order.channel) await assertWithinAllocation(order.channel, need);
}

/** Undo deductions made so far when a later line fails (no history rows left behind). */
async function rollback(moves: { product: Types.ObjectId; qty: number; txnId: Types.ObjectId }[]) {
  for (const m of moves) {
    await Inventory.updateOne({ product: m.product }, { $inc: { quantity: m.qty } });
    await StockTransaction.deleteOne({ _id: m.txnId });
  }
}

/**
 * PENDING → a sale status (Confirmed by default; Shipped / Delivered / Completed when the order is
 * moved straight there): validate stock, deduct it, book the income, post any upfront payment once.
 */
export async function confirmOrder(
  id: string,
  user: SessionUser,
  note = "",
  to: OrderStatus = "CONFIRMED",
  extra: Record<string, unknown> = {}
): Promise<void> {
  const order = await loadOrder(id);
  if (order.status !== "PENDING") throw new AppError("Only pending orders can be confirmed", 409);
  if (!isSale(to)) throw new AppError("Invalid status", 422);
  await checkSellable(order);
  await claim(order, to, user, note, { confirmedAt: new Date(), ...extra });

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
      { $set: { status: "PENDING", confirmedAt: null, ...Object.fromEntries(Object.keys(extra).map((k) => [k, order[k as keyof OrderDoc] ?? null])) }, $pop: { history: 1 } }
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
    // Posted once: re-confirming after a move back to Pending must not take the payment again
    await Order.updateOne({ _id: order._id }, { $set: { upfrontPaymentPaise: 0 } });
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

const isSale = (s: OrderStatus) => (SALE_STATUSES as OrderStatus[]).includes(s);

/** Courier / tracking / delivered-time fields that go with a move to `to`. */
function shipmentFields(order: OrderDoc, to: OrderStatus, input: StatusChangeInput): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  if (input.courier !== undefined) set.courier = input.courier.trim();
  if (input.trackingNumber !== undefined) set.trackingNumber = input.trackingNumber.trim();
  if ((to === "SHIPPED" || to === "DELIVERED" || to === "COMPLETED") && !order.shippedAt) set.shippedAt = new Date();
  if ((to === "DELIVERED" || to === "COMPLETED") && !order.deliveredAt) set.deliveredAt = new Date();
  return set;
}

function blockIfPaid(order: OrderDoc, what: string) {
  if (order.paidPaise > 0) {
    throw new AppError(`Money has been received on this order. Record a refund (or cancel the order) before moving it back to ${what}.`, 409);
  }
}

/**
 * Any allowed status move (see ORDER_TRANSITIONS), with its stock / income side effects:
 * Pending → sale status deducts stock + books income; sale → Pending / Cancelled / Returned puts
 * the stock back + reverses the income; moves between sale statuses only change the status.
 */
export async function changeOrderStatus(id: string, input: StatusChangeInput, user: SessionUser): Promise<void> {
  const order = await loadOrder(id);
  const to = input.status;
  if (to === order.status) return;
  if (!ORDER_TRANSITIONS[order.status].includes(to)) {
    throw new AppError(`An order that is ${order.status.toLowerCase()} cannot be moved to ${to.toLowerCase()}`, 409);
  }
  const note = input.note?.trim() ?? "";
  const from = order.status;

  if (from === "PENDING" && isSale(to)) return confirmOrder(id, user, note, to, shipmentFields(order, to, input));

  if (from === "CANCELLED") {
    // Only back to Pending (re-open); nothing was deducted while cancelled
    blockIfPaid(order, "Pending");
    await claim(order, "PENDING", user, note || "Order re-opened", { confirmedAt: null });
  } else if (to === "CANCELLED") {
    await claim(order, "CANCELLED", user, note);
    if (isSale(from)) await reverseSale(order, "ORDER_CANCEL", user, note || "Order cancelled");
  } else if (to === "RETURNED") {
    await claim(order, "RETURNED", user, note);
    await reverseSale(order, "ORDER_RETURN", user, note || "Order returned");
  } else if (to === "PENDING") {
    blockIfPaid(order, "Pending");
    await claim(order, "PENDING", user, note || "Moved back to pending", { confirmedAt: null });
    await reverseSale(order, "ORDER_CANCEL", user, note || "Moved back to pending");
  } else {
    await claim(order, to, user, note, shipmentFields(order, to, input));
  }
  await recomputeOrder(order._id);
}

/**
 * Saves courier / tracking number. Adding a tracking number to a confirmed order moves it to
 * Shipped, as the user asked: "once tracking is updated, update the status".
 */
export async function updateShipment(id: string, input: { courier: string; trackingNumber: string }, user: SessionUser) {
  const order = await loadOrder(id);
  if (!isSale(order.status)) {
    throw new AppError("Tracking can be added only to confirmed, shipped, delivered or completed orders", 409);
  }
  const trackingNumber = input.trackingNumber.trim();
  const set: Record<string, unknown> = { courier: input.courier.trim(), trackingNumber };
  if (trackingNumber && !order.shippedAt) set.shippedAt = new Date();
  if (order.status === "CONFIRMED" && trackingNumber) {
    await claim(order, "SHIPPED", user, `Shipped${set.courier ? ` via ${set.courier}` : ""} — tracking ${trackingNumber}`, set);
  } else {
    await Order.updateOne({ _id: order._id }, { $set: set });
  }
}
