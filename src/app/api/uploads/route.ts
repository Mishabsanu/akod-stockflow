import { DOCUMENT_FOLDERS, MAX_DOCUMENTS, type DocumentFolder } from "@/lib/documents";
import { can, type PermissionModule } from "@/lib/permissions";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { uploadDocument } from "@/server/services/upload.service";

const FOLDER_MODULE: Record<DocumentFolder, PermissionModule> = {
  running_orders: "running_order",
  delivery_notes: "delivery_note",
  return_notes: "return_note",
  workers: "worker",
  cheques: "cheque",
  leads: "lead",
  quotes: "quote",
  expenses: "expense",
  payments: "payment",
  leaves: "leave",
  productions: "production",
  stock: "stock",
  products: "product",
  checkups: "mechanical_checkup",
  audits: "facility_audit",
};

/** multipart `files` (max 10 per request) + `?folder=` → uploaded documents, not yet linked to a record. */
export const POST = apiHandler("authenticated", async ({ req, user }) => {
  const folder = req.nextUrl.searchParams.get("folder") as DocumentFolder;
  if (!DOCUMENT_FOLDERS.includes(folder)) throw new AppError("Unknown upload folder", 422);
  const mod = FOLDER_MODULE[folder];
  if (!can(user, mod, "create") && !can(user, mod, "update")) {
    throw new AppError("You do not have permission to perform this action", 403);
  }

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new AppError("Choose at least one file", 422);
  if (files.length > Math.min(10, MAX_DOCUMENTS)) throw new AppError("Upload at most 10 files at a time", 422);

  return { documents: await Promise.all(files.map((f) => uploadDocument(f, folder))) };
});
