import { ReportScreen } from "@/components/reports/ReportScreen";

export const metadata = { title: "Report" };

export default async function Page({ params, searchParams }: PageProps<"/dashboard/reports/[key]">) {
  const { key } = await params;
  return <ReportScreen reportKey={key} group="reports" searchParams={searchParams} backHref="/dashboard/reports" backLabel="All reports" />;
}
