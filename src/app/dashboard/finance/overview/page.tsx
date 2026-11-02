import { ArrowDownLeft, ArrowUpRight, Banknote, HandCoins, IndianRupee, Receipt, Scale, TrendingUp, Wallet, Waves } from "lucide-react";
import { BarList, KpiGrid, Panel, type Kpi } from "@/components/dashboard/DashboardParts";
import { CashFlowChart, RevenueExpenseChart } from "@/components/finance/dashboard/FinanceCharts";
import { PeriodFilter } from "@/components/reports/PeriodFilter";
import { SERIES } from "@/components/reports/chartTheme";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency } from "@/lib/format";
import { periodLabel, resolvePeriod } from "@/lib/periods";
import { getPageAccess } from "@/server/auth/session";
import { getFinanceDashboard } from "@/server/services/finance/dashboard.service";

export const metadata = { title: "Finance Dashboard" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({ searchParams }: PageProps<"/dashboard/finance/overview">) {
  const { allowed } = await getPageAccess("finance_dashboard", "view");
  if (!allowed) return <AccessDenied />;
  const params = await searchParams;
  const period = resolvePeriod({ period: one(params.period), from: one(params.from), to: one(params.to) });
  const data = await getFinanceDashboard({ from: period.from, to: period.to });
  const k = data.kpis;

  const kpis: Kpi[] = [
    { label: "Total Revenue", value: formatCurrency(k.revenue), icon: IndianRupee, tone: "in", href: "/dashboard/finance/income" },
    { label: "Total Expenses", value: formatCurrency(k.expenses), icon: Receipt, tone: "out", href: "/dashboard/finance/expenses" },
    { label: "Gross Profit", value: formatCurrency(k.grossProfit), hint: `Revenue − ${formatCurrency(k.cogs)} cost of goods`, icon: Scale, tone: k.grossProfit >= 0 ? "in" : "out" },
    {
      label: "Net Profit",
      value: formatCurrency(k.netProfit),
      hint: "Gross profit − expenses",
      icon: TrendingUp,
      tone: k.netProfit >= 0 ? "in" : "out",
      href: "/dashboard/finance/reports/profit-loss",
    },
    { label: "Cash Flow", value: formatCurrency(k.cashFlow), hint: "Received − paid out", icon: Waves, tone: k.cashFlow >= 0 ? "in" : "out", href: "/dashboard/finance/reports/cash-flow" },
    { label: "Payments Received", value: formatCurrency(k.received), icon: ArrowDownLeft, tone: "in", href: "/dashboard/finance/payments" },
    { label: "Payments Made", value: formatCurrency(k.made), icon: ArrowUpRight, tone: "out", href: "/dashboard/finance/payments" },
    { label: "Pending Receivables", value: formatCurrency(k.receivables), hint: "As of today", icon: HandCoins, tone: "warn", href: "/dashboard/finance/receivables" },
    { label: "Pending Payables", value: formatCurrency(k.payables), hint: "As of today", icon: Wallet, tone: "out", href: "/dashboard/finance/payables" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Finance Dashboard" description={`Revenue, expenses, profit and cash · ${periodLabel(data.range)}`} />
      <PeriodFilter period={period.key} from={period.from} to={period.to} />
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Revenue vs expenses" subtitle={`Per ${data.unit}`} href="/dashboard/finance/reports/profit-loss" linkLabel="P&L">
          <RevenueExpenseChart points={data.series} />
        </Panel>
        <Panel title="Cash flow" subtitle={`Payments received and made per ${data.unit}`} href="/dashboard/finance/reports/cash-flow" linkLabel="Report">
          <CashFlowChart points={data.series} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Revenue by source" href="/dashboard/finance/reports/sales-revenue" linkLabel="Report">
          <BarList empty="No revenue in this period yet" rows={data.incomeByCategory.map((r) => ({ key: r.key, label: r.label, value: r.value, color: SERIES[0] }))} />
        </Panel>
        <Panel title="Expenses by category" href="/dashboard/finance/reports/expenses" linkLabel="Report">
          <BarList empty="No expenses in this period yet" rows={data.expenseByCategory.map((r) => ({ key: r.key, label: r.label, value: r.value, color: SERIES[1] }))} />
        </Panel>
        <Panel title="Cash & bank balances" subtitle="Opening balance + received − paid, as of today" href="/dashboard/finance/accounts" linkLabel="Ledger">
          {data.accounts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No accounts yet</p>
          ) : (
            <ul className="divide-y divide-line -my-2">
              {data.accounts.map((a) => (
                <li key={a._id} className="flex items-center gap-3 py-2.5">
                  <span className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0">
                    {a.type === "CASH" ? <Banknote className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-slate-800 truncate">{a.name}</span>
                    <span className="block text-[10.5px] text-slate-500">{a.type === "CASH" ? "Cash" : "Bank"}</span>
                  </span>
                  <span className={`text-[13px] font-bold tabular-nums ${a.balance < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatCurrency(a.balance)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-2.5 text-[12px] font-bold text-slate-700">
                Total
                <span className="tabular-nums text-slate-900">{formatCurrency(data.accounts.reduce((s, a) => s + a.balance, 0))}</span>
              </li>
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
