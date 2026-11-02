import { mrReceiveSchema } from "@/lib/validation/materialRequest.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { receiveMaterialRequest } from "@/server/services/materialRequest.service";

/** Adds the received quantities to central stock. */
export const POST = apiHandler<{ id: string }>({ module: "material_request", action: "update" }, async ({ req, user, params }) =>
  receiveMaterialRequest(params.id, await readBody(req, mrReceiveSchema), user)
);
