import { accountSchema } from "@/lib/validation/finance.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { createAccount, listAccountOptions, listAccounts } from "@/server/services/finance/account.service";

/** ?options=1 → active accounts for payment forms (any finance user may need them). */
export const GET = apiHandler("authenticated", async ({ req }) =>
  req.nextUrl.searchParams.get("options") === "1" ? listAccountOptions() : listAccounts()
);

export const POST = apiHandler({ module: "account", action: "create" }, async ({ req }) =>
  createAccount(await readBody(req, accountSchema))
);
