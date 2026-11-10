import "server-only";
import type { Model } from "mongoose";
import { can, type PermissionModule } from "@/lib/permissions";
import type { RecycleBinItem } from "@/lib/recycleBinTypes";
import type { Paginated, SessionUser } from "@/lib/types";
import { AppError, notFound } from "../http/errors";
import { escapeRegex, paginate, type ListQuery } from "../http/query";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Channel } from "../models/Channel";
import { Customer } from "../models/Customer";
import { Expense } from "../models/Expense";
import { FinanceTransaction } from "../models/FinanceTransaction";
import { Inventory } from "../models/Inventory";
import { Manufacturer } from "../models/Manufacturer";
import { MaterialRequest } from "../models/MaterialRequest";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Product } from "../models/Product";
import { Role } from "../models/Role";
import { originalValue, purgeBatchIn, restoreBatchIn, restoreConflicts, type SoftDeleteFields } from "../models/softDelete";
import { User } from "../models/User";
import { recomputeExpense, recomputeOrder } from "./finance/settlement";
import { destroyDocuments } from "./upload.service";

type Doc = SoftDeleteFields & Record<string, unknown> & { _id: unknown };

interface Entity {
  key: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  module: PermissionModule;
  /** Name shown in the bin */
  title: (d: Doc) => string;
  /** Extra line under the name */
  detail?: (d: Doc) => string;
  /** Where the restored record can be opened */
  href?: (id: string, d: Doc) => string | undefined;
}

const v = <T = string>(d: Doc, f: string) => originalValue<T>(d, f);
const rupees = (paise: unknown) => `₹${(Number(paise ?? 0) / 100).toLocaleString("en-IN")}`;

/** Every model that uses soft delete. Order matters only for display. */
export const ENTITIES: Entity[] = [
  {
    key: "product",
    label: "Product",
    model: Product,
    module: "product",
    title: (d) => `${v(d, "sku")} — ${d.name}`,
    detail: (d) => (d.parent ? "Variant" : d.hasVariants ? "Product with variants (restored together)" : "Product"),
    href: (id) => `/dashboard/products/${id}`,
  },
  { key: "category", label: "Category", model: Category, module: "category", title: (d) => String(d.name), href: () => "/dashboard/products/categories" },
  {
    key: "manufacturer",
    label: "Batch Number",
    model: Manufacturer,
    module: "production",
    title: (d) => `${(v<string[]>(d, "batchCodes") ?? []).join(", ")} — ${d.name}`,
    href: (id) => `/dashboard/production/${id}`,
  },
  { key: "channel", label: "Marketplace", model: Channel, module: "channel", title: (d) => `${v(d, "code")} — ${d.name}`, href: (id) => `/dashboard/channels/${id}` },
  { key: "customer", label: "Customer", model: Customer, module: "customer", title: (d) => `${d.code} — ${d.name}`, href: (id) => `/dashboard/orders/customers/${id}` },
  { key: "order", label: "Order", model: Order, module: "order", title: (d) => `${d.orderNo} — ${d.customerName ?? ""}`, href: (id) => `/dashboard/orders/${id}` },
  {
    key: "material_request",
    label: "Material Request",
    model: MaterialRequest,
    module: "material_request",
    title: (d) => String(d.mrNo),
    href: (id) => `/dashboard/inventory/requests/${id}`,
  },
  {
    key: "expense",
    label: "Expense",
    model: Expense,
    module: "expense",
    title: (d) => `${d.expenseNo} — ${d.payee ?? d.category ?? ""}`,
    detail: (d) => rupees(d.amountPaise),
    href: (id) => `/dashboard/finance/expenses/${id}`,
  },
  {
    key: "income",
    label: "Income",
    model: FinanceTransaction,
    module: "income",
    title: (d) => `${d.txnNo} — ${d.description ?? d.category ?? ""}`,
    detail: (d) => `${rupees(d.amountPaise)} · payment restored with it`,
    href: () => "/dashboard/finance/income",
  },
  {
    key: "payment",
    label: "Payment",
    model: Payment,
    module: "payment",
    title: (d) => `${d.paymentNo} — ${d.partyName || d.referenceLabel || d.referenceType}`,
    detail: (d) => `${d.direction === "RECEIVED" ? "Received" : "Paid"} ${rupees(d.amountPaise)}`,
    href: () => "/dashboard/finance/payments",
  },
  { key: "account", label: "Cash / Bank Account", model: Account, module: "account", title: (d) => `${v(d, "code")} — ${d.name}`, href: () => "/dashboard/finance/accounts" },
  { key: "user", label: "User", model: User, module: "user", title: (d) => `${d.name} (${v(d, "email")})`, href: (id) => `/dashboard/settings/users/${id}` },
  { key: "role", label: "Role", model: Role, module: "role", title: (d) => String(d.name), href: (id) => `/dashboard/settings/roles/${id}` },
];

const PER_TYPE_LIMIT = 500;

/** Deleted items the user may see (one row per delete action), newest first. */
export async function listRecycleBin(query: ListQuery, user: SessionUser): Promise<Paginated<RecycleBinItem>> {
  const visible = ENTITIES.filter((e) => can(user, e.module, "view") && (!query.filters.type || e.key === query.filters.type));
  const rx = query.search ? new RegExp(escapeRegex(query.search), "i") : null;

  const groups = await Promise.all(
    visible.map(async (e) => {
      const docs = await e.model
        .find({ deletedPrimary: true, deletedAt: { $ne: null } })
        .sort({ deletedAt: -1 })
        .limit(PER_TYPE_LIMIT)
        .lean<Doc[]>();
      return docs.map((d) => ({ e, d }));
    })
  );
  const rows = groups.flat().filter(({ e, d }) => !rx || rx.test(e.title(d)) || rx.test(e.label));
  rows.sort((a, b) => new Date(String(b.d.deletedAt)).getTime() - new Date(String(a.d.deletedAt)).getTime());

  const page = rows.slice((query.page - 1) * query.limit, query.page * query.limit);
  const userIds = [...new Set(page.map((r) => String(r.d.deletedBy ?? "")).filter(Boolean))];
  // Users who deleted things may themselves be deleted: read names including deleted ones
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select("name").lean() : [];
  const deletedUsers = userIds.length ? await User.find({ _id: { $in: userIds }, deletedAt: { $ne: null } }).select("name").lean() : [];
  const names = new Map([...users, ...deletedUsers].map((u) => [String(u._id), u.name]));

  const items: RecycleBinItem[] = page.map(({ e, d }) => ({
    _id: String(d.deleteBatch),
    type: e.key,
    typeLabel: e.label,
    title: e.title(d),
    detail: e.detail?.(d) ?? "",
    deletedAt: new Date(String(d.deletedAt)).toISOString(),
    deletedBy: names.get(String(d.deletedBy ?? "")) ?? "",
    canRestore: can(user, e.module, "delete"),
  }));
  return paginate(items, rows.length, query);
}

/** Entity of the record the user deleted in this batch. */
async function primaryOf(batch: string) {
  // All modules at once (indexed on deleteBatch) instead of one after another
  const hits = await Promise.all(
    ENTITIES.map((e) => e.model.findOne({ deleteBatch: batch, deletedAt: { $ne: null }, deletedPrimary: true }).lean<Doc>())
  );
  const i = hits.findIndex(Boolean);
  return i === -1 ? null : { e: ENTITIES[i], d: hits[i]! };
}

/** Restores everything deleted in one action. Fails (nothing changed) if a unique value is taken meanwhile. */
export async function restoreFromBin(batch: string, user: SessionUser): Promise<{ type: string; href?: string }> {
  const found = await primaryOf(batch);
  if (!found) throw notFound("Deleted item");
  if (!can(user, found.e.module, "delete")) throw new AppError("You do not have permission to perform this action", 403);

  const clashes = (await Promise.all(ENTITIES.map((e) => restoreConflicts(e.model, batch)))).flat();
  if (clashes.length) {
    throw new AppError(`Cannot restore: ${clashes.join("; ")} is now used by another record. Change that record first.`, 409);
  }

  // A restored variant needs a live parent
  const { d, e } = found;
  if (e.key === "product" && d.parent && !(await Product.exists({ _id: d.parent }))) {
    throw new AppError("Restore its product first — this variant's product is deleted.", 409);
  }

  const restored: Record<string, string[]> = {};
  const results = await Promise.all(ENTITIES.map((ent) => restoreBatchIn(ent.model, batch)));
  ENTITIES.forEach((ent, i) => (restored[ent.key] = results[i]));

  // Keep linked totals right after a restore
  if (e.key === "product" && d.parent) await Product.updateOne({ _id: d.parent }, { hasVariants: true });
  if (restored.payment.length) {
    const pays = await Payment.find({ _id: { $in: restored.payment } }).select("referenceType referenceId").lean();
    for (const p of pays) {
      if (p.referenceType === "ORDER") await recomputeOrder(p.referenceId);
      if (p.referenceType === "EXPENSE") await recomputeExpense(p.referenceId);
    }
  }
  for (const id of restored.expense) await recomputeExpense(id);
  return { type: e.label, href: e.href?.(String(d._id), d) };
}

/** Deletes the batch forever (and its product photos). */
export async function purgeFromBin(batch: string, user: SessionUser): Promise<void> {
  const found = await primaryOf(batch);
  if (!found) throw notFound("Deleted item");
  if (!can(user, found.e.module, "delete")) throw new AppError("You do not have permission to perform this action", 403);
  const products = await Product.find({ deletedAt: { $ne: null }, deleteBatch: batch }).select("_id images").lean();
  if (products.length) await Inventory.deleteMany({ product: { $in: products.map((p) => p._id) } });
  const cats = await Category.find({ deletedAt: { $ne: null }, deleteBatch: batch }).select("image").lean();
  await Promise.all(ENTITIES.map((ent) => purgeBatchIn(ent.model, batch)));
  await destroyDocuments([...products.flatMap((p) => p.images ?? []), ...cats.flatMap((c) => (c.image ? [c.image] : []))]);
}
