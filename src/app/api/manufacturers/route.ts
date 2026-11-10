import { manufacturerSchema } from "@/lib/validation/manufacturer.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createManufacturer, listManufacturers } from "@/server/services/manufacturer.service";

export const GET = apiHandler({ module: "production", action: "view" }, async ({ req }) =>
  listManufacturers(parseListQuery(req.nextUrl.searchParams))
);

export const POST = apiHandler({ module: "production", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, manufacturerSchema);
  return createManufacturer(input, user._id);
});
