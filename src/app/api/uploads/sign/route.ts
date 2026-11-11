import { apiHandler } from "@/server/http/handler";
import { assertUploadAllowed, signDirectUpload } from "@/server/services/upload.service";

/**
 * `?folder=` → signed parameters for one or more direct browser → Cloudinary uploads.
 * Same permission check as /api/uploads; the file itself never passes through this server.
 */
export const POST = apiHandler("authenticated", async ({ req, user }) => {
  const folder = assertUploadAllowed(user, req.nextUrl.searchParams.get("folder"));
  return signDirectUpload(folder);
});
