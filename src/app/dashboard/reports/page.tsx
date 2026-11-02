import Link from "next/link";
import { ReportHub } from "@/components/reports/ReportHub";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPageAccess } from "@/server/auth/session";
import { listReports } from "@/server/services/report.service";

export const metadata = { title: "Reports" };

export default async function Page() {
  const { allowed } = await getPageAccess("report", "view");
  if (!allowed) return <AccessDenied />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Products, inventory, stock movements, orders, sales by channel and money in / out — each with search, date filters, sorting and CSV export"
        actions={
          <Link href="/dashboard/finance/reports" className="inline-flex items-center h-9 px-3.5 text-xs font-bold rounded-lg bg-brand hover:bg-brand-dark text-white">
            Financial Reports
          </Link>
        }
      />
      <ReportHub reports={listReports("reports")} basePath="/dashboard/reports" />
    </div>
  );
}
