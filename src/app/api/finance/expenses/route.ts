import { expenseSchema } from "@/lib/validation/finance.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createExpense, EXPENSE_FILTERS, listExpenses } from "@/server/services/finance/expense.service";

export const GET = apiHandler({ module: "expense", action: "view" }, async ({ req }) =>
  listExpenses(parseListQuery(req.nextUrl.searchParams, EXPENSE_FILTERS))
);

export const POST = apiHandler({ module: "expense", action: "create" }, async ({ req, user }) =>
  createExpense(await readBody(req, expenseSchema), user._id)
);
