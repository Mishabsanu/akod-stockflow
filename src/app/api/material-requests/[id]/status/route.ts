import { can } from "@/lib/permissions";
import { mrActionSchema } from "@/lib/validation/materialRequest.schema";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { changeMaterialRequestStatus, getMaterialRequest } from "@/server/services/materialRequest.service";

/** Approve / reject need material_request:update; the requester may cancel their own request. */
export const POST = apiHandler<{ id: string }>({ module: "material_request", action: "view" }, async ({ req, user, params }) => {
  const input = await readBody(req, mrActionSchema);
  const approver = can(user, "material_request", "update");
  if (!approver) {
    const mr = await getMaterialRequest(params.id);
    const own = mr.requestedBy?._id === user._id;
    if (input.action !== "cancel" || !own) throw new AppError("You do not have permission to perform this action", 403);
  }
  return changeMaterialRequestStatus(params.id, input, user);
});
