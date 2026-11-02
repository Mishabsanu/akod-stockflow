import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { exportEntity, getEntity, importEntity } from "@/server/io/registry";
import { fileResponse } from "@/server/io/sheet";

/**
 * Download of a list (same filters as the screen).
 * ?format=csv (default xlsx) · ?template=1 gives just the import headings.
 */
export const GET = apiHandler<{ entity: string }>("authenticated", async ({ req, user, params }) => {
  const entity = getEntity(params.entity, user, "export");
  const search = req.nextUrl.searchParams;
  const format = search.get("format") === "csv" ? "csv" : "xlsx";
  const { buffer, filename } = await exportEntity(entity, search, search.get("template") === "1", format);
  return fileResponse(buffer, filename, format);
});

/** Excel / CSV upload. ?dryRun=1 previews every row without saving; otherwise rows are created / updated. */
export const POST = apiHandler<{ entity: string }>("authenticated", async ({ req, user, params }) => {
  const entity = getEntity(params.entity, user, "import");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AppError("Choose a file to upload", 422);
  const search = req.nextUrl.searchParams;
  return importEntity(entity, file, user, search.get("dryRun") === "1", search);
});
