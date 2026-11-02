import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { isDay } from "@/lib/indiaDate";
import { periodLabel, resolvePeriod } from "@/lib/periods";
import type { ReportGroup } from "@/lib/reportTypes";
import { getPageAccess } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { getReportDef, runReport } from "@/server/services/report.service";
import type { ReportDef } from "@/server/services/reports/engine";
import { ExportCsvButton } from "./ExportCsvButton";
import { PeriodFilter } from "./PeriodFilter";
import { ReportView } from "./ReportView";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function findDef(key: string): ReportDef {
  try {
    return getReportDef(key);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

interface ReportScreenProps {
  reportKey: string;
  searchParams: Promise<SearchParams>;
  /** Hub this report is opened from; a report of another group 404s there */
  group?: ReportGroup;
  backHref?: string;
  backLabel?: string;
  itemName?: string;
}

/** Server page body for any report: access check, period filter, export, summary, chart and table. */
export async function ReportScreen({ reportKey, searchParams, group, backHref, backLabel, itemName }: ReportScreenProps) {
  const def = findDef(reportKey);
  if (group && def.meta.group !== group) notFound();
  const { allowed } = await getPageAccess(def.permission, "view");
  if (!allowed) return <AccessDenied />;

  const params = await searchParams;
  const report = await runReport(def, params);

  const from = one(params.from);
  const to = one(params.to);
  const period =
    def.meta.dateMode === "required"
      ? resolvePeriod({ period: one(params.period), from, to })
      : null;
  const optionalActive = isDay(from) || isDay(to);

  return (
    <div className="space-y-4">
      <PageHeader
        title={def.meta.title}
        description={`${def.meta.description}${report.range && def.meta.dateMode === "required" ? ` · ${periodLabel(report.range)}` : ""}`}
        actions={
          <>
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel ?? "Back"}
              </Link>
            )}
            <ExportCsvButton reportKey={def.meta.key} />
          </>
        }
      />
      {period && <PeriodFilter period={period.key} from={period.from} to={period.to} />}
      {def.meta.dateMode === "optional" && (
        <PeriodFilter period={optionalActive ? "custom" : "all"} from={from} to={to} allowAll />
      )}
      <ReportView report={report} itemName={itemName} />
    </div>
  );
}
