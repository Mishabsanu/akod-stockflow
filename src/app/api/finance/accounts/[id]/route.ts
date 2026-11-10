import { accountSchema } from "@/lib/validation/finance.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteAccount, getAccount, updateAccount } from "@/server/services/finance/account.service";

export const GET = apiHandler<{ id: string }>({ module: "account", action: "view" }, async ({ params }) => getAccount(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "account", action: "update" }, async ({ req, params }) =>
  updateAccount(params.id, await readBody(req, accountSchema))
);

export const DELETE = apiHandler<{ id: string }>({ module: "account", action: "delete" }, async ({ params, user }) => {
  await deleteAccount(params.id, user._id);
  return { success: true };
});
