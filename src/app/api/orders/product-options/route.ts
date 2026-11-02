import { apiHandler } from "@/server/http/handler";
import { listOrderProductOptions } from "@/server/services/order.service";

/**
 * Products the order form can add: ?type=MARKETPLACE&channel=<id> → only that marketplace's
 * products (channel price); LOCAL / DISTRIBUTOR → every active product. Each carries its stock.
 */
export const GET = apiHandler({ module: "order", action: "view" }, async ({ req }) => {
  const p = req.nextUrl.searchParams;
  return { items: await listOrderProductOptions(p.get("type") ?? "", p.get("channel") ?? undefined) };
});
