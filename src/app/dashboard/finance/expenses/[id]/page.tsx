import { ExpenseDetailPage } from "@/components/finance/expenses/ExpensePages";

export const metadata = { title: "Expense" };

export default function Page({ params, searchParams }: PageProps<"/dashboard/finance/expenses/[id]">) {
  return <ExpenseDetailPage params={params} searchParams={searchParams} />;
}
