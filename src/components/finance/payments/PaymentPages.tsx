import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listAccountOptions } from "@/server/services/finance/account.service";
import { listPayments, PAYMENT_FILTERS } from "@/server/services/finance/payment.service";
import { DateRangeFilter } from "../shared/DateRangeFilter";
import { MoneyTile } from "../shared/FinanceWidgets";
import { PaymentListView } from "./PaymentListView";
import { RecordPaymentModal } from "./RecordPaymentModal";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function PaymentListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("payment", "view");
  if (!allowed) return <AccessDenied />;
  const query = parseListQuery(await searchParams, PAYMENT_FILTERS);
  const [data, accounts] = await Promise.all([listPayments(query), listAccountOptions()]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment received and made. Payments against an order or expense update its paid and balance amounts."
        actions={
          <>
            <ImportExport entity="payments" title="Payments" />
            {can(user, "payment", "create") && <RecordPaymentModal accounts={accounts} />}
          </>
        }
      />
      <DateRangeFilter from={query.filters.from ?? ""} to={query.filters.to ?? ""} allowBlank />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MoneyTile label="Received" value={data.totals.received} tone="in" />
        <MoneyTile label="Made" value={data.totals.made} tone="out" />
        <MoneyTile label="Net" value={data.totals.received - data.totals.made} tone={data.totals.received >= data.totals.made ? "brand" : "warn"} hint="Received − made (filters applied)" />
      </div>
      <PaymentListView data={data} accounts={accounts.map(({ value, label }) => ({ value, label }))} />
    </>
  );
}
