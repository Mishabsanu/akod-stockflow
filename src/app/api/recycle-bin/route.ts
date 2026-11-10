import { apiHandler } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { listRecycleBin } from "@/server/services/recycleBin.service";

/** Deleted items the user can see (per-module view permission), `?type=` to filter. */
export const GET = apiHandler("authenticated", async ({ req, user }) => listRecycleBin(parseListQuery(req.nextUrl.searchParams, ["type"]), user));
