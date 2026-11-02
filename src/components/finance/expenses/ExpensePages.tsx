import { Receipt } from "lucide-react";
import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/financeTypes";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listAccountOptions } from "@/server/services/finance/account.service";
import { EXPENSE_FILTERS, getExpenseWithPayments, listChannelOptions, listExpenses } from "@/server/services/finance/expense.service";
import { orNotFound } from "@/server/utils/pageData";
import { PaymentHistory } from "../payments/PaymentHistory";
import { DateRangeFilter } from "../shared/DateRangeFilter";
import { ExpenseStatusBadge, methodLabel } from "../shared/FinanceBadges";
import { FINANCE_PATHS } from "../shared/financeUi";
import { MoneyTile } from "../shared/FinanceWidgets";
import { NewExpenseButton } from "./ExpenseFormModal";
import { ExpenseListView } from "./ExpenseListView";
import { ExpenseRowActions } from "./ExpenseRowActions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function formOptions() {
  const [accounts, channels] = await Promise.all([listAccountOptions(), listChannelOptions()]);
  return { accounts, channels };
}

export async function ExpenseListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("expense", "view");
  if (!allowed) return <AccessDenied />;
  const query = parseListQuery(await searchParams, EXPENSE_FILTERS);
  const [data, options] = await Promise.all([listExpenses(query), formOptions()]);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Business expenses. Unpaid or partly paid ones show in Payables; record payments with the wallet button."
        actions={
          <>
            <ImportExport entity="expenses" title="Expenses" />
            {can(user, "expense", "create") && <NewExpenseButton {...options} />}
          </>
        }
      />
      <DateRangeFilter from={query.filters.from ?? ""} to={query.filters.to ?? ""} allowBlank />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MoneyTile label="Total expenses" value={data.totals.amount} hint="Excludes cancelled" />
        <MoneyTile label="Paid" value={data.totals.paid} tone="in" />
        <MoneyTile label="Balance payable" value={data.totals.balance} tone={data.totals.balance ? "out" : "neutral"} />
      </div>
      <ExpenseListView data={data} options={options} />
    </>
  );
}

export async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { allowed } = await getPageAccess("expense", "view");
  if (!allowed) return <AccessDenied />;
  const { id } = await params;
  const [{ expense, payments }, options] = await Promise.all([orNotFound(getExpenseWithPayments(id)), formOptions()]);

  return (
    <div className="space-y-4">
      <DetailCard
        title={expense.expenseNo}
        subtitle={`${EXPENSE_CATEGORY_LABELS[expense.category]}${expense.payeeName ? ` · ${expense.payeeName}` : ""}`}
        badge={<ExpenseStatusBadge status={expense.status} />}
        icon={<Receipt className="w-4.5 h-4.5" />}
        backHref={FINANCE_PATHS.expenses}
      >
        <div className="flex justify-end -mt-1 mb-3">
          <ExpenseRowActions expense={expense} options={options} showView={false} autoPay={(await searchParams)?.pay === "1"} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <MoneyTile label="Amount" value={expense.amount} />
          <MoneyTile label="Paid" value={expense.paid} tone="in" />
          <MoneyTile label="Balance" value={expense.balance} tone={expense.balance ? "out" : "neutral"} />
        </div>
        <DetailSection title="Expense">
          <DetailItem label="Expense Date" value={formatDay(expense.expenseDate)} />
          <DetailItem label="Due Date" value={expense.dueDate ? formatDay(expense.dueDate) : "—"} />
          <DetailItem label="Category" value={EXPENSE_CATEGORY_LABELS[expense.category]} />
          <DetailItem label="Payee" value={expense.payeeName || "—"} />
          <DetailItem label="Marketplace" value={expense.channel?.name ?? "—"} />
          <DetailItem label="Reference No" value={expense.referenceNo || "—"} mono />
          <DetailItem label="Payment Method" value={methodLabel(expense.paymentMethod)} />
          <DetailItem label="Created" value={formatDateTime(expense.createdAt)} />
          <DetailItem label="Description" value={expense.description || "—"} />
        </DetailSection>
      </DetailCard>
      <PaymentHistory payments={payments} title="Payments made" emptyText={`Nothing paid yet — ${formatCurrency(expense.balance)} is due.`} />
    </div>
  );
}
