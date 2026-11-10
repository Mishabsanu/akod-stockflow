import { apiHandler } from "@/server/http/handler";
import { lookupBatchCode } from "@/server/services/manufacturer.service";

/** `?code=27` (or a full printed batch code) → `{ result: { matchedCode, manufacturer } | null }`. Signed-in users only. */
export const GET = apiHandler({ module: "production", action: "view" }, async ({ req }) => ({
  result: await lookupBatchCode(req.nextUrl.searchParams.get("code") ?? ""),
}));
