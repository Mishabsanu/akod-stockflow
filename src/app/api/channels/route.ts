import { channelSchema } from "@/lib/validation/channel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createChannel, listChannelOptions, listChannels } from "@/server/services/channel.service";

/** GET list — or `?options=1` → `{ options: { value, label }[] }` of active marketplaces (`&all=1` includes inactive). */
export const GET = apiHandler({ module: "channel", action: "view" }, async ({ req }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("options") === "1") return { options: await listChannelOptions(params.get("all") === "1") };
  return listChannels(parseListQuery(params));
});

export const POST = apiHandler({ module: "channel", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, channelSchema);
  return createChannel(input, user._id);
});
