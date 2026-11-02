import { ExpenseListPage } from "@/components/finance/expenses/ExpensePages";

export const metadata = { title: "Expenses" };

export default function Page({ searchParams }: PageProps<"/dashboard/finance/expenses">) {
  return <ExpenseListPage searchParams={searchParams} />;
}
