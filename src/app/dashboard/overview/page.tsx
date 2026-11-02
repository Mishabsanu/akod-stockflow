import { AlertTriangle, Boxes, ClipboardList, HandCoins, IndianRupee, Package, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { BarList, BuildProgressCard, KpiGrid, Panel, RecentOrders, RecentStock, TopProducts, type Kpi } from "@/components/dashboard/DashboardParts";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { ORDER_TYPE_COLOR } from "@/components/reports/chartTheme";
import { PageHeader } from "@/components/ui/PageHeader";
import { ORDER_TYPE_LABELS, ORDER_TYPES, type OrderType } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import { can } from "@/lib/permissions";
import { periodLabel, resolvePeriod } from "@/lib/periods";
import { requireUser } from "@/server/auth/session";
import { getDashboard } from "@/server/services/dashboard.service";

export const metadata = { title: "Dashboard" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({ searchParams }: PageProps<"/dashboard/overview">) {
  const user = await requireUser();
  const params = await searchParams;
  const period = resolvePeriod({ period: one(params.period), from: one(params.from), to: one(params.to) });
  const rawType = one(params.orderType);
  const orderType = (ORDER_TYPES as readonly string[]).includes(rawType) ? (rawType as OrderType) : "";
  const data = await getDashboard({ from: period.from, to: period.to }, orderType);
  const k = data.kpis;

  const seesFinance = can(user, "finance_dashboard", "view");
  const seesPayments = can(user, "payment", "view");
  const typeNote = orderType ? ` · ${ORDER_TYPE_LABELS[orderType]} only` : "";

  const kpis: Kpi[] = [
    { label: "Total Products", value: formatNumber(k.products), hint: `${formatNumber(k.activeProducts)} active`, icon: Package, href: "/dashboard/products" },
    {
      label: "Available Stock",
      value: `${formatNumber(k.stockUnits)} units`,
      hint: k.lowStock ? `${k.lowStock} low / out of stock` : "No low-stock alerts",
      icon: k.lowStock ? AlertTriangle : Boxes,
      tone: k.lowStock ? "warn" : "brand",
      href: k.lowStock ? "/dashboard/inventory/low-stock" : "/dashboard/inventory",
    },
    { label: "Total Orders", value: formatNumber(k.orders), hint: "Created in period (all statuses)", icon: ClipboardList, href: "/dashboard/orders" },
    { label: "Total Sales", value: formatCurrency(k.salesValue), hint: `${formatNumber(k.salesCount)} confirmed+ orders`, icon: ShoppingCart, tone: "in" },
  ];
  if (seesFinance) {
    kpis.push(
      { label: "Total Revenue", value: formatCurrency(k.revenue), hint: "Order + other income", icon: IndianRupee, tone: "in", href: "/dashboard/finance/income" },
      { label: "Total Expenses", value: formatCurrency(k.expenses), hint: "Not filtered by order type", icon: Receipt, tone: "out", href: "/dashboard/finance/expenses" },
      {
        label: "Net Profit",
        value: formatCurrency(k.netProfit),
        hint: `After ${formatCurrency(k.cogs)} cost of goods`,
        icon: TrendingUp,
        tone: k.netProfit >= 0 ? "in" : "out",
        href: "/dashboard/finance/reports/profit-loss",
      }
    );
  }
  if (seesPayments) {
    kpis.push(
      { label: "Pending Receivables", value: formatCurrency(k.receivables), hint: "Owed on confirmed orders", icon: HandCoins, tone: "warn", href: "/dashboard/finance/receivables" },
      { label: "Pending Payables", value: formatCurrency(k.payables), hint: "Unpaid expenses", icon: Wallet, tone: "out", href: "/dashboard/finance/payables" }
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Welcome, ${user.name}`} description={`Business overview · ${periodLabel(data.range)}${typeNote}`} />
      <DashboardFilters period={period.key} from={period.from} to={period.to} orderType={orderType} />
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          title="Sales & revenue"
          subtitle={`Sales by order type per ${data.unit}, revenue as a line`}
          href={seesFinance ? "/dashboard/finance/reports/sales-revenue" : undefined}
          linkLabel="Report"
          className="xl:col-span-2"
        >
          <SalesTrendChart points={data.trend} />
        </Panel>
        <Panel title="Order type distribution" subtitle="Sales value and orders (confirmed, processing, completed)">
          <BarList
            empty="No sales in this period yet"
            rows={data.byType.map((t) => ({
              key: t.type,
              label: t.label,
              value: t.value,
              color: ORDER_TYPE_COLOR[t.type],
              detail: `${t.count} orders`,
              href: `/dashboard/orders/${t.type.toLowerCase()}`,
            }))}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          title="Top selling products"
          subtitle="By units sold in the period (confirmed, processing, completed orders)"
          href="/dashboard/reports/products"
          linkLabel="Report"
          className="xl:col-span-2"
        >
          <TopProducts rows={data.topProducts} />
        </Panel>
        <Panel title="Top selling marketplaces" subtitle="Ranked by sales value in the period" href="/dashboard/reports/marketplace-sales" linkLabel="Report">
          <BarList
            empty="No marketplace sales in this period yet"
            rows={data.byChannel.map((c, i) => ({
              key: c._id,
              label: `${i + 1}. ${c.name}`,
              value: c.value,
              detail: `${formatNumber(c.units)} units · ${c.count} orders`,
              color: ORDER_TYPE_COLOR.MARKETPLACE,
              href: `/dashboard/orders/marketplace?channel=${c._id}`,
            }))}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Recent orders" href="/dashboard/orders">
          <RecentOrders orders={data.recentOrders} />
        </Panel>
        <Panel title="Recent stock transactions" href="/dashboard/inventory/transactions">
          <RecentStock rows={data.recentStock} />
        </Panel>
      </div>

      <BuildProgressCard />
    </div>
  );
}
