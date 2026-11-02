import { channelSchema, channelStatusSchema } from "@/lib/validation/channel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteChannel, getChannel, setChannelStatus, updateChannel } from "@/server/services/channel.service";

type P = { id: string };

export const GET = apiHandler<P>({ module: "channel", action: "view" }, async ({ params }) => getChannel(params.id));

export const PUT = apiHandler<P>({ module: "channel", action: "update" }, async ({ req, params }) => {
  const input = await readBody(req, channelSchema);
  return updateChannel(params.id, input);
});

/** Activate / deactivate: `{ status: "active" | "inactive" }`. */
export const PATCH = apiHandler<P>({ module: "channel", action: "update" }, async ({ req, params }) => {
  const { status } = await readBody(req, channelStatusSchema);
  return setChannelStatus(params.id, status);
});

export const DELETE = apiHandler<P>({ module: "channel", action: "delete" }, async ({ params }) => {
  await deleteChannel(params.id);
  return { success: true };
});
