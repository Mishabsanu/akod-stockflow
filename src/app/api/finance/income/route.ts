import { incomeSchema } from "@/lib/validation/finance.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createOtherIncome, INCOME_FILTERS, listIncome } from "@/server/services/finance/income.service";

export const GET = apiHandler({ module: "income", action: "view" }, async ({ req }) =>
  listIncome(parseListQuery(req.nextUrl.searchParams, INCOME_FILTERS))
);

/** Other income (received now). Order income is created by confirming an order. */
export const POST = apiHandler({ module: "income", action: "create" }, async ({ req, user }) =>
  createOtherIncome(await readBody(req, incomeSchema), user._id)
);
