import { ReportScreen } from "@/components/reports/ReportScreen";

export const metadata = { title: "Financial Report" };

export default async function Page({ params, searchParams }: PageProps<"/dashboard/finance/reports/[key]">) {
  const { key } = await params;
  return (
    <ReportScreen reportKey={key} group="finance" searchParams={searchParams} backHref="/dashboard/finance/reports" backLabel="Financial reports" />
  );
}
