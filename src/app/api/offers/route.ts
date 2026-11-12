import { offerSchema } from "@/lib/validation/offer.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createOffer, listOfferPage } from "@/server/services/offer.service";

export const GET = apiHandler({ module: "offer", action: "view" }, async ({ req }) => listOfferPage(parseListQuery(req.nextUrl.searchParams)));

export const POST = apiHandler({ module: "offer", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, offerSchema);
  return createOffer(input, user._id);
});
