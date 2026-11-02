import { ReportScreen } from "@/components/reports/ReportScreen";

export const metadata = { title: "Receivables" };

/** Outstanding on confirmed orders; "Record payment" opens the order, which holds the payment form. */
export default function Page({ searchParams }: PageProps<"/dashboard/finance/receivables">) {
  return <ReportScreen reportKey="receivables" searchParams={searchParams} itemName="receivables" />;
}
