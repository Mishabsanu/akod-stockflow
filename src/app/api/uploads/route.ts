import { MAX_DOCUMENTS } from "@/lib/documents";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { assertUploadAllowed, uploadDocument } from "@/server/services/upload.service";

/**
 * multipart `files` (max 10 per request) + `?folder=` → uploaded documents, not yet linked to a record.
 * Browsers upload directly to Cloudinary (see /api/uploads/sign); this route stays for small files and scripts.
 */
export const POST = apiHandler("authenticated", async ({ req, user }) => {
  const folder = assertUploadAllowed(user, req.nextUrl.searchParams.get("folder"));

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new AppError("Choose at least one file", 422);
  if (files.length > Math.min(10, MAX_DOCUMENTS)) throw new AppError("Upload at most 10 files at a time", 422);

  return { documents: await Promise.all(files.map((f) => uploadDocument(f, folder))) };
});
