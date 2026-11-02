import "server-only";
import { isValidObjectId, type Model } from "mongoose";
import { documentsSchema, type AttachedDocument } from "@/lib/documents";
import type { PermissionModule } from "@/lib/permissions";
import { AppError, notFound } from "../http/errors";
import { apiHandler, readBody } from "../http/handler";
import { destroyRemoved } from "../services/upload.service";
import { toPlain } from "../utils/serialize";

type StoredDocs = { publicId: string; resourceType: string }[];

/**
 * `PUT /api/<resource>/[id]/documents` with `{ documents }`: replaces the record's document list
 * (files are uploaded first through /api/uploads) and deletes removed files from Cloudinary.
 * `field` is where the list is stored (workers use `files`: legacy workers already have `documents`).
 */
export function documentRoutes(
  module: PermissionModule,
  model: Model<never>,
  label: string,
  field = "documents",
  /** Runs after the list is saved, e.g. to sync expiry reminders */
  afterSave?: (id: string) => Promise<void>
) {
  const PUT = apiHandler<{ id: string }>({ module, action: "update" }, async ({ req, params }) => {
    const { documents } = await readBody(req, documentsSchema);
    if (!isValidObjectId(params.id)) throw notFound(label);
    const Docs = model as unknown as Model<Record<string, StoredDocs | undefined>>;
    const before = await Docs.findById(params.id).select(field).lean();
    if (!before) throw notFound(label);
    await Docs.updateOne({ _id: params.id }, { $set: { [field]: documents } });
    await destroyRemoved(Array.isArray(before[field]) ? before[field] : [], documents);
    if (afterSave) await afterSave(params.id);
    return { documents: toPlain<AttachedDocument[]>(documents) };
  });
  return { PUT };
}

/**
 * `PUT /api/<resource>/[id]/signed` with `{ documents: [] | [doc] }`: stores one file in a single slot
 * (`signedDocument`) — the same payload as the list route so `DocumentsPanel` can drive both.
 */
export function singleDocumentRoutes(module: PermissionModule, model: Model<never>, label: string, field = "signedDocument") {
  const PUT = apiHandler<{ id: string }>({ module, action: "update" }, async ({ req, params }) => {
    const { documents } = await readBody(req, documentsSchema);
    if (documents.length > 1) throw new AppError("Only one file can be attached here", 422, { documents: "Only one file" });
    if (!isValidObjectId(params.id)) throw notFound(label);
    const Docs = model as unknown as Model<Record<string, StoredDocs[number] | null | undefined>>;
    const before = await Docs.findById(params.id).select(field).lean();
    if (!before) throw notFound(label);
    await Docs.updateOne({ _id: params.id }, { $set: { [field]: documents[0] ?? null } });
    await destroyRemoved(before[field] ? [before[field]] : [], documents);
    return { documents: toPlain<AttachedDocument[]>(documents) };
  });
  return { PUT };
}
