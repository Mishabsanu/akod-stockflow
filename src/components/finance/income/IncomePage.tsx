import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listAccountOptions } from "@/server/services/finance/account.service";
import { INCOME_FILTERS, listIncome } from "@/server/services/finance/income.service";
import { DateRangeFilter } from "../shared/DateRangeFilter";
import { IncomeFormModal } from "./IncomeFormModal";
import { IncomeListView } from "./IncomeListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function IncomeListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("income", "view");
  if (!allowed) return <AccessDenied />;
  const query = parseListQuery(await searchParams, INCOME_FILTERS);
  const [data, accounts] = await Promise.all([listIncome(query), can(user, "income", "create") ? listAccountOptions() : []]);

  return (
    <>
      <PageHeader
        title="Income"
        description="Sales income is booked when an order is confirmed (reversed if it is cancelled / returned). Add other income here."
        actions={
          <>
            <ImportExport entity="income" title="Income" />
            {can(user, "income", "create") && <IncomeFormModal accounts={accounts} />}
          </>
        }
      />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <DateRangeFilter from={query.filters.from ?? ""} to={query.filters.to ?? ""} allowBlank />
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total income (active)</p>
          <p className="text-lg font-black tabular-nums text-emerald-700">{formatCurrency(data.totalAmount)}</p>
        </div>
      </div>
      <IncomeListView data={data} />
    </>
  );
}
