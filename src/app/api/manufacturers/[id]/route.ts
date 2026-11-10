import { manufacturerSchema } from "@/lib/validation/manufacturer.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteManufacturer, getManufacturer, updateManufacturer } from "@/server/services/manufacturer.service";

export const GET = apiHandler<{ id: string }>({ module: "production", action: "view" }, async ({ params }) => getManufacturer(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "production", action: "update" }, async ({ req, params }) => {
  const input = await readBody(req, manufacturerSchema);
  return updateManufacturer(params.id, input);
});

export const DELETE = apiHandler<{ id: string }>({ module: "production", action: "delete" }, async ({ params }) => {
  await deleteManufacturer(params.id);
  return { success: true };
});
