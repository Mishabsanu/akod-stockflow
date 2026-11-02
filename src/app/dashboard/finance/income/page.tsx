import { IncomeListPage } from "@/components/finance/income/IncomePage";

export const metadata = { title: "Income" };

export default function Page({ searchParams }: PageProps<"/dashboard/finance/income">) {
  return <IncomeListPage searchParams={searchParams} />;
}
