import {
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  Boxes,
  ClipboardList,
  FileBarChart,
  HandCoins,
  History,
  Package,
  Receipt,
  Store,
  TrendingUp,
  Truck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReportMeta } from "@/lib/reportTypes";

const ICONS: Record<string, LucideIcon> = {
  products: Package,
  inventory: Boxes,
  "stock-transactions": History,
  orders: ClipboardList,
  "marketplace-sales": Store,
  "local-sales": UserRound,
  "distributor-sales": Truck,
  finance: Wallet,
  "profit-loss": TrendingUp,
  "cash-flow": Banknote,
  "sales-revenue": BadgeIndianRupee,
  expenses: Receipt,
  receivables: HandCoins,
  payables: Receipt,
  "marketplace-revenue": Store,
  "local-sales-summary": UserRound,
  "distributor-sales-summary": Truck,
};

/** Grid of report cards; each opens `${basePath}/<key>`. */
export function ReportHub({ reports, basePath }: { reports: ReportMeta[]; basePath: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {reports.map((r) => {
        const Icon = ICONS[r.key] ?? FileBarChart;
        return (
          <Link
            key={r.key}
            href={`${basePath}/${r.key}`}
            className="group bg-white border border-line rounded-xl p-4 flex gap-3 hover:border-brand-border hover:shadow-sm transition"
          >
            <span className="w-10 h-10 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[13px] font-bold text-slate-900 group-hover:text-brand">
                {r.title}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="block text-[11.5px] text-slate-500 mt-0.5 leading-snug">{r.description}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2">
                {r.dateMode === "none" ? "Current position" : r.dateMode === "optional" ? "Any date range" : "Date range"} · CSV export
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
