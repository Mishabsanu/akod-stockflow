import { randomUUID } from "node:crypto";
import { Schema, type Model, type PipelineStage, type Query } from "mongoose";

/**
 * Soft delete (Recycle Bin). A deleted record keeps its data and gets `deletedAt`; every query on the
 * model skips it automatically (find, count, distinct, update, aggregate, populate …), so lists,
 * balances and reports behave as if it were gone.
 *
 * - One user action = one `deleteBatch` (e.g. an income and its payment); restoring restores the batch.
 * - `deletedPrimary` marks what the user deleted (shown in the Recycle Bin); the rest went with it.
 * - Unique values (SKU, email, batch numbers …) are freed while deleted (suffixed and saved in
 *   `deletedValues`) so they can be reused, and are put back on restore.
 * - To read deleted records, put `deletedAt` in the filter yourself, e.g. `{ deletedAt: { $ne: null } }`.
 * - bulkWrite and raw collection access are not filtered.
 */

/** Query operations that skip deleted records (query middleware only, not document methods). */
const QUERY_OPS =
  /^(find|findOne|findOneAndUpdate|findOneAndReplace|findOneAndDelete|countDocuments|distinct|updateOne|updateMany|replaceOne|deleteOne|deleteMany)$/;

const UNIQUE_FIELDS = new WeakMap<Schema, string[]>();
const SUFFIX = "~DEL~";

export interface SoftDeleteFields {
  deletedAt?: Date | null;
  deletedBy?: unknown;
  deleteBatch?: string | null;
  deletedPrimary?: boolean;
  deletedValues?: Record<string, unknown> | null;
}

export function softDeletePlugin(schema: Schema, opts: { unique?: string[] } = {}) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deleteBatch: { type: String, default: null, index: true },
    deletedPrimary: { type: Boolean, default: false },
    deletedValues: { type: Schema.Types.Mixed, default: null },
  });
  UNIQUE_FIELDS.set(schema, opts.unique ?? []);

  schema.pre(QUERY_OPS, { document: false, query: true }, function (this: Query<unknown, unknown>) {
    if (typeof this.getFilter !== "function") return;
    const filter = this.getFilter();
    if (!filter || !Object.prototype.hasOwnProperty.call(filter, "deletedAt")) this.where({ deletedAt: null });
  });

  schema.pre("aggregate", function () {
    const pipeline = this.pipeline();
    const first = pipeline[0] as { $match?: Record<string, unknown> } | undefined;
    if (first?.$match && Object.prototype.hasOwnProperty.call(first.$match, "deletedAt")) return;
    pipeline.unshift({ $match: { deletedAt: null } } as PipelineStage);
  });
}

export const newDeleteBatch = () => randomUUID();

const isDeleted = { deletedAt: { $ne: null } };
const strip = (v: unknown) => (typeof v === "string" && v.includes(SUFFIX) ? v.slice(0, v.indexOf(SUFFIX)) : v);

/** Original value of a field on a deleted record (unique fields are suffixed while deleted). */
export function originalValue<T>(doc: SoftDeleteFields & Record<string, unknown>, field: string): T {
  const saved = doc.deletedValues?.[field];
  return (saved !== undefined ? saved : doc[field]) as T;
}

/**
 * Soft-deletes everything matching `filter` as part of `batch`. `primary` marks the user's own pick
 * (shown in the Recycle Bin). Returns how many records were deleted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function softDelete(model: Model<any>, filter: Record<string, unknown>, ctx: { batch: string; userId?: string | null; primary?: boolean }) {
  const unique = UNIQUE_FIELDS.get(model.schema) ?? [];
  const docs = await model.find(filter).select(["_id", ...unique].join(" ")).lean<Record<string, unknown>[]>();
  if (docs.length === 0) return 0;
  const now = new Date();
  await model.bulkWrite(
    docs.map((d) => {
      const set: Record<string, unknown> = {
        deletedAt: now,
        deletedBy: ctx.userId ?? null,
        deleteBatch: ctx.batch,
        deletedPrimary: Boolean(ctx.primary),
      };
      const saved: Record<string, unknown> = {};
      for (const f of unique) {
        const v = d[f];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
        saved[f] = v;
        set[f] = Array.isArray(v) ? v.map((x) => `${x}${SUFFIX}${d._id}`) : `${v}${SUFFIX}${d._id}`;
      }
      set.deletedValues = Object.keys(saved).length ? saved : null;
      return { updateOne: { filter: { _id: d._id }, update: { $set: set } } };
    })
  );
  return docs.length;
}

/** Unique values of a batch's records that another (live) record now uses — restore would clash. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function restoreConflicts(model: Model<any>, batch: string): Promise<string[]> {
  const unique = UNIQUE_FIELDS.get(model.schema) ?? [];
  if (unique.length === 0) return [];
  const docs = await model.find({ ...isDeleted, deleteBatch: batch }).select("deletedValues").lean<SoftDeleteFields[]>();
  const clashes: string[] = [];
  for (const d of docs) {
    for (const [f, v] of Object.entries(d.deletedValues ?? {})) {
      if (!unique.includes(f)) continue;
      const values = (Array.isArray(v) ? v : [v]).map(strip);
      const taken = await model.findOne({ [f]: { $in: values } }).select(f).lean<Record<string, unknown>>();
      if (taken) {
        const used = (Array.isArray(taken[f]) ? (taken[f] as unknown[]) : [taken[f]]).filter((x) => values.includes(x));
        clashes.push(`${f} ${used.join(", ")}`);
      }
    }
  }
  return clashes;
}

/** Brings back every record of the batch with its original unique values. Returns ids restored. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function restoreBatchIn(model: Model<any>, batch: string): Promise<string[]> {
  const docs = await model.find({ ...isDeleted, deleteBatch: batch }).select("_id deletedValues").lean<(SoftDeleteFields & { _id: unknown })[]>();
  if (docs.length === 0) return [];
  await model.bulkWrite(
    docs.map((d) => ({
      updateOne: {
        filter: { _id: d._id },
        update: {
          $set: { ...(d.deletedValues ?? {}), deletedAt: null, deletedBy: null, deleteBatch: null, deletedPrimary: false, deletedValues: null },
        },
      },
    }))
  );
  return docs.map((d) => String(d._id));
}

/** Permanently removes the batch's records from this model. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function purgeBatchIn(model: Model<any>, batch: string): Promise<number> {
  const res = await model.deleteMany({ ...isDeleted, deleteBatch: batch });
  return res.deletedCount ?? 0;
}
