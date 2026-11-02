import { channelProductSchema } from "@/lib/validation/channel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { removeChannelProducts, updateChannelProduct } from "@/server/services/channel.service";

type P = { id: string; cpId: string };

/** Marketplace SKU / price of one listing. */
export const PUT = apiHandler<P>({ module: "channel", action: "update" }, async ({ req, params }) => {
  const input = await readBody(req, channelProductSchema);
  await updateChannelProduct(params.id, params.cpId, input);
  return { success: true };
});

export const DELETE = apiHandler<P>({ module: "channel", action: "update" }, async ({ params }) =>
  removeChannelProducts(params.id, [params.cpId])
);
