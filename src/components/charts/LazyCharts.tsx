"use client";

/**
 * Code-split charts: recharts is the largest library in the app, so it is downloaded only when a
 * chart is on screen, after the rest of the page has rendered. A chart-shaped skeleton shows
 * meanwhile. Charts need the browser (they measure their container), so they skip SSR.
 */
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/Skeleton";

const loading = () => <ChartSkeleton />;

export const SalesTrendChart = dynamic(() => import("@/components/dashboard/SalesTrendChart").then((m) => m.SalesTrendChart), {
  ssr: false,
  loading,
});

export const RevenueExpenseChart = dynamic(
  () => import("@/components/finance/dashboard/FinanceCharts").then((m) => m.RevenueExpenseChart),
  { ssr: false, loading }
);

export const CashFlowChart = dynamic(() => import("@/components/finance/dashboard/FinanceCharts").then((m) => m.CashFlowChart), {
  ssr: false,
  loading,
});

export const ReportChart = dynamic(() => import("@/components/reports/ReportChart").then((m) => m.ReportChart), {
  ssr: false,
  loading,
});
