import { ExpenseEditPage } from "@/components/finance/expenses/ExpensePages";

export const metadata = { title: "Edit Expense" };

export default function Page({ params }: PageProps<"/dashboard/finance/expenses/[id]/edit">) {
  return <ExpenseEditPage params={params} />;
}
