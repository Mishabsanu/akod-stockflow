import { ReportHub } from "@/components/reports/ReportHub";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPageAccess } from "@/server/auth/session";
import { listReports } from "@/server/services/report.service";

export const metadata = { title: "Financial Reports" };

export default async function Page() {
  const { allowed } = await getPageAccess("report", "view");
  if (!allowed) return <AccessDenied />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Financial Reports"
        description="Profit & loss, cash flow, revenue, expenses, receivables, payables and sales by channel — date filters and CSV export"
      />
      <ReportHub reports={listReports("finance")} basePath="/dashboard/finance/reports" />
    </div>
  );
}
