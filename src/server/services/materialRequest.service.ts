import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { highestPriority, type MaterialRequest, type MrPriority, type MrStatus } from "@/lib/materialRequestTypes";
import type { Paginated, SessionUser } from "@/lib/types";
import type { MaterialRequestInput, MrActionInput, MrReceiveInput } from "@/lib/validation/materialRequest.schema";
import { nextCode } from "../models/Counter";
import { MaterialRequest as MrModel, type MaterialRequestDoc } from "../models/MaterialRequest";
import { Product } from "../models/Product";
import { AppError, notFound } from "../http/errors";
import { escapeRegex, paginate, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";
import { moveStock, stockFor } from "./stock.service";

/** Extra list filters read from the URL. */
export const MR_FILTERS = ["mrStatus", "priority", "from", "to", "mine"];

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  requiredBy: { requiredBy: 1, createdAt: -1 },
  // Sorted on a computed rank (High → Medium → Low), see listMaterialRequests
  priority: { priorityRank: 1, createdAt: -1 },
};

const event = (status: MrStatus, user: SessionUser, note = "") => ({ status, at: new Date(), by: user.name, note });

/** Adds totals (and current stock when asked) to a stored request. */
function shape(doc: MaterialRequestDoc, stock?: Map<string, number>): MaterialRequest {
  const plain = toPlain<MaterialRequest>(doc);
  plain.items = plain.items.map((i) => ({ ...i, stock: stock?.get(String(i.product)) }));
  plain.totalQty = plain.items.reduce((s, i) => s + i.quantity, 0);
  plain.receivedQty = plain.items.reduce((s, i) => s + i.receivedQty, 0);
  return plain;
}

export async function listMaterialRequests(query: ListQuery, user?: SessionUser): Promise<Paginated<MaterialRequest>> {
  const filter: Filter = {};
  const { mrStatus, priority, from, to, mine } = query.filters;
  if (priority === "HIGH" || priority === "MEDIUM" || priority === "LOW") filter.priority = priority;
  if (mrStatus === "OPEN") filter.status = { $in: ["PENDING", "APPROVED", "PARTIALLY_RECEIVED"] };
  else if (mrStatus) filter.status = mrStatus;
  if (from || to) filter.requestDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (mine === "1" && user) filter.requestedBy = new Types.ObjectId(user._id);
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ mrNo: rx }, { requestedByName: rx }, { "items.sku": rx }, { "items.name": rx }, { notes: rx }];
  }
  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    query.sort === "priority"
      ? MrModel.aggregate<MaterialRequestDoc>([
          { $match: filter },
          { $addFields: { priorityRank: { $indexOfArray: [["HIGH", "MEDIUM", "LOW"], "$priority"] } } },
          { $sort: SORTS.priority },
          { $skip: skip },
          { $limit: query.limit },
          { $project: { __v: 0, priorityRank: 0 } },
        ])
      : MrModel.find(filter).sort(SORTS[query.sort] || SORTS.newest).skip(skip).limit(query.limit).select("-__v").lean<MaterialRequestDoc[]>(),
    MrModel.countDocuments(filter),
  ]);
  return paginate(docs.map((d) => shape(d)), total, query);
}

async function loadDoc(id: string): Promise<MaterialRequestDoc> {
  if (!isValidObjectId(id)) throw notFound("Material request");
  const doc = await MrModel.findById(id).lean<MaterialRequestDoc>();
  if (!doc) throw notFound("Material request");
  return doc;
}

export async function getMaterialRequest(id: string): Promise<MaterialRequest> {
  const doc = await loadDoc(id);
  return shape(doc, await stockFor(doc.items.map((i) => i.product)));
}

/** Snapshots SKU / name; products must exist and be active. */
async function buildItems(items: MaterialRequestInput["items"]) {
  const ids = items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids } }).select("sku name status hasVariants").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return items.map((i, n) => {
    const p = byId.get(i.product);
    if (!p) throw new AppError(`Line ${n + 1}: product not found`, 422);
    if (p.status !== "active") throw new AppError(`${p.sku} is inactive`, 409);
    if (p.hasVariants) throw new AppError(`${p.sku} has variants — choose one of its variants`, 422);
    return { product: p._id, sku: p.sku, name: p.name, quantity: i.quantity, receivedQty: 0, priority: (i.priority ?? "MEDIUM") as MrPriority };
  });
}

export async function createMaterialRequest(input: MaterialRequestInput, user: SessionUser): Promise<MaterialRequest> {
  const items = await buildItems(input.items);
  const doc = await MrModel.create({
    mrNo: await nextCode("material_request", "MR", 5),
    requestDate: input.requestDate,
    requiredBy: input.requiredBy ?? "",
    priority: highestPriority(items.map((i) => i.priority)),
    requestedBy: user._id,
    requestedByName: user.name,
    items,
    notes: input.notes ?? "",
    status: "PENDING",
    history: [event("PENDING", user, "Request raised")],
  });
  return getMaterialRequest(String(doc._id));
}

/** Only pending requests can change; the requester or someone who can approve may edit. */
function assertEditable(doc: MaterialRequestDoc, user: SessionUser, canApprove: boolean) {
  if (doc.status !== "PENDING") throw new AppError("Only pending requests can be changed", 409);
  if (!canApprove && String(doc.requestedBy) !== user._id) throw new AppError("You can change only your own requests", 403);
}

export async function updateMaterialRequest(id: string, input: MaterialRequestInput, user: SessionUser, canApprove: boolean) {
  const doc = await loadDoc(id);
  assertEditable(doc, user, canApprove);
  const items = await buildItems(input.items);
  const res = await MrModel.updateOne(
    { _id: doc._id, status: "PENDING" },
    {
      $set: {
        requestDate: input.requestDate,
        requiredBy: input.requiredBy ?? "",
        priority: highestPriority(items.map((i) => i.priority)),
        items,
        notes: input.notes ?? "",
      },
    }
  );
  if (res.matchedCount !== 1) throw new AppError("This request was changed by someone else. Refresh and try again.", 409);
  return getMaterialRequest(id);
}

export async function deleteMaterialRequest(id: string, user: SessionUser, canApprove: boolean): Promise<void> {
  const doc = await loadDoc(id);
  assertEditable(doc, user, canApprove);
  await MrModel.deleteOne({ _id: doc._id, status: "PENDING" });
}

const NEXT: Record<MrActionInput["action"], { from: MrStatus[]; to: MrStatus }> = {
  approve: { from: ["PENDING"], to: "APPROVED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  cancel: { from: ["PENDING", "APPROVED"], to: "CANCELLED" },
};

/** Approve / reject / cancel. Approving needs material_request:update (checked by the route). */
export async function changeMaterialRequestStatus(id: string, input: MrActionInput, user: SessionUser): Promise<MaterialRequest> {
  const doc = await loadDoc(id);
  const step = NEXT[input.action];
  if (!step.from.includes(doc.status)) {
    throw new AppError(`A request that is ${doc.status.toLowerCase().replace("_", " ")} cannot be ${step.to.toLowerCase()}`, 409);
  }
  if (input.action === "cancel" && doc.items.some((i) => i.receivedQty > 0)) {
    throw new AppError("Stock has already been received against this request", 409);
  }
  const note = input.reason?.trim() ?? "";
  const set: Record<string, unknown> = { status: step.to };
  if (input.action === "approve") Object.assign(set, { approvedBy: user._id, approvedByName: user.name, approvedAt: new Date() });
  if (input.action === "reject") set.rejectReason = note;
  const res = await MrModel.updateOne({ _id: doc._id, status: doc.status }, { $set: set, $push: { history: event(step.to, user, note) } });
  if (res.modifiedCount !== 1) throw new AppError("This request was changed by someone else. Refresh and try again.", 409);
  return getMaterialRequest(id);
}

/**
 * Receives stock against an approved request: each line adds to central stock (STOCK_IN with the
 * MR number as reference). Partial receipts are allowed; a line can never receive more than requested.
 */
export async function receiveMaterialRequest(id: string, input: MrReceiveInput, user: SessionUser): Promise<MaterialRequest> {
  const doc = await loadDoc(id);
  if (doc.status !== "APPROVED" && doc.status !== "PARTIALLY_RECEIVED") {
    throw new AppError("Stock can be received only on an approved request", 409);
  }
  const items = doc.items.map((i) => ({ ...i }));
  const byProduct = new Map(items.map((i) => [String(i.product), i]));
  const lines = input.lines.filter((l) => (l.quantity ?? 0) > 0);
  for (const l of lines) {
    const item = byProduct.get(l.product);
    if (!item) throw new AppError("A product in the receipt is not on this request", 422);
    const remaining = item.quantity - item.receivedQty;
    if (l.quantity > remaining) throw new AppError(`${item.sku}: only ${remaining} left to receive`, 422);
  }

  // Claim the request first so two people cannot receive the same quantity twice
  const claimed = await MrModel.updateOne({ _id: doc._id, updatedAt: doc.updatedAt }, { $set: { updatedAt: new Date() } });
  if (claimed.modifiedCount !== 1) throw new AppError("This request was changed by someone else. Refresh and try again.", 409);

  for (const l of lines) {
    const item = byProduct.get(l.product)!;
    await moveStock({
      product: item.product,
      sku: item.sku,
      change: l.quantity,
      type: "STOCK_IN",
      txnDate: input.receiptDate,
      poNumber: input.poNumber ?? "",
      reference: doc.mrNo,
      reason: `Received against ${doc.mrNo}`,
      source: "manual",
      userId: user._id,
    });
    item.receivedQty += l.quantity;
  }
  const done = items.every((i) => i.receivedQty >= i.quantity);
  const status: MrStatus = done ? "RECEIVED" : "PARTIALLY_RECEIVED";
  const summary = lines.map((l) => `${byProduct.get(l.product)!.sku} +${l.quantity}`).join(", ");
  await MrModel.updateOne(
    { _id: doc._id },
    { $set: { items, status }, $push: { history: event(status, user, `${summary}${input.poNumber ? ` · PO ${input.poNumber}` : ""}`) } }
  );
  return getMaterialRequest(id);
}

/** Open requests count for the inventory header. */
export async function countOpenMaterialRequests(): Promise<number> {
  return MrModel.countDocuments({ status: { $in: ["PENDING", "APPROVED", "PARTIALLY_RECEIVED"] } });
}
