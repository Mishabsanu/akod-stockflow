import { apiHandler } from "@/server/http/handler";
import { deleteIncome, getIncome } from "@/server/services/finance/income.service";

export const GET = apiHandler<{ id: string }>({ module: "income", action: "view" }, async ({ params }) => getIncome(params.id));

export const DELETE = apiHandler<{ id: string }>({ module: "income", action: "delete" }, async ({ params, user }) => {
  await deleteIncome(params.id, user._id);
  return { success: true };
});
