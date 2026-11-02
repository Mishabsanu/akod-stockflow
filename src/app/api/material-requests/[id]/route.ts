import { can } from "@/lib/permissions";
import { materialRequestSchema } from "@/lib/validation/materialRequest.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import {
  deleteMaterialRequest,
  getMaterialRequest,
  updateMaterialRequest,
} from "@/server/services/materialRequest.service";

type P = { id: string };

export const GET = apiHandler<P>({ module: "material_request", action: "view" }, async ({ params }) => getMaterialRequest(params.id));

/** Requesters edit their own pending requests; approvers (update) may edit any pending one. */
export const PUT = apiHandler<P>({ module: "material_request", action: "create" }, async ({ req, user, params }) =>
  updateMaterialRequest(params.id, await readBody(req, materialRequestSchema), user, can(user, "material_request", "update"))
);

export const DELETE = apiHandler<P>({ module: "material_request", action: "create" }, async ({ user, params }) => {
  await deleteMaterialRequest(params.id, user, can(user, "material_request", "update") || can(user, "material_request", "delete"));
  return { success: true };
});
