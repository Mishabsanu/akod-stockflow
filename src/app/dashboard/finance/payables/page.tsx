import { ReportScreen } from "@/components/reports/ReportScreen";

export const metadata = { title: "Payables" };

/** Unpaid expenses; "Record payment" opens the expense, which holds the payment form. */
export default function Page({ searchParams }: PageProps<"/dashboard/finance/payables">) {
  return <ReportScreen reportKey="payables" searchParams={searchParams} itemName="payables" />;
}
