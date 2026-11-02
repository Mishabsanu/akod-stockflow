import { materialRequestSchema } from "@/lib/validation/materialRequest.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createMaterialRequest, listMaterialRequests, MR_FILTERS } from "@/server/services/materialRequest.service";

export const GET = apiHandler({ module: "material_request", action: "view" }, async ({ req, user }) =>
  listMaterialRequests(parseListQuery(req.nextUrl.searchParams, MR_FILTERS), user)
);

/** "Requested by" is always the signed-in user. */
export const POST = apiHandler({ module: "material_request", action: "create" }, async ({ req, user }) =>
  createMaterialRequest(await readBody(req, materialRequestSchema), user)
);
