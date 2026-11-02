import { apiHandler } from "@/server/http/handler";
import { cancelExpense } from "@/server/services/finance/expense.service";

export const POST = apiHandler<{ id: string }>({ module: "expense", action: "update" }, async ({ params }) => cancelExpense(params.id));
