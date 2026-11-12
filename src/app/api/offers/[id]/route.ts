import { offerSchema } from "@/lib/validation/offer.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteOffer, getOffer, updateOffer } from "@/server/services/offer.service";

export const GET = apiHandler<{ id: string }>({ module: "offer", action: "view" }, async ({ params }) => getOffer(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "offer", action: "update" }, async ({ req, params }) => {
  const input = await readBody(req, offerSchema);
  return updateOffer(params.id, input);
});

export const DELETE = apiHandler<{ id: string }>({ module: "offer", action: "delete" }, async ({ params }) => {
  await deleteOffer(params.id);
  return { success: true };
});
