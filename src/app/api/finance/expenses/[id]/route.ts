import { expenseSchema } from "@/lib/validation/finance.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteExpense, getExpenseWithPayments, updateExpense } from "@/server/services/finance/expense.service";

export const GET = apiHandler<{ id: string }>({ module: "expense", action: "view" }, async ({ params }) =>
  getExpenseWithPayments(params.id)
);

export const PUT = apiHandler<{ id: string }>({ module: "expense", action: "update" }, async ({ req, params }) =>
  updateExpense(params.id, await readBody(req, expenseSchema))
);

export const DELETE = apiHandler<{ id: string }>({ module: "expense", action: "delete" }, async ({ params, user }) => {
  await deleteExpense(params.id, user._id);
  return { success: true };
});
