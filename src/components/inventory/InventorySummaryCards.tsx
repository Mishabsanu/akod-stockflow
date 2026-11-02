import { AlertTriangle, Boxes, IndianRupee, Package, PackageX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { InventorySummary } from "@/server/services/inventory.service";

function Card({ label, value, icon, tone, href }: { label: string; value: string; icon: ReactNode; tone: string; href?: string }) {
  const body = (
    <div className="bg-white border border-line rounded-xl p-3 sm:p-4 flex items-center gap-3 h-full hover:border-brand-border transition">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{label}</p>
        <p className="text-base sm:text-lg font-black text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Totals for active products: count, units on hand, value at cost, low and out of stock. */
export function InventorySummaryCards({ summary }: { summary: InventorySummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card label="Active Products" value={formatNumber(summary.products)} icon={<Package className="w-4.5 h-4.5" />} tone="bg-brand-light text-brand" />
      <Card label="Units Available" value={formatNumber(summary.units)} icon={<Boxes className="w-4.5 h-4.5" />} tone="bg-sky-50 text-sky-700" />
      <Card label="Stock Value" value={formatCurrency(summary.value)} icon={<IndianRupee className="w-4.5 h-4.5" />} tone="bg-emerald-50 text-emerald-700" />
      <Card
        label="Low Stock"
        value={formatNumber(summary.low)}
        icon={<AlertTriangle className="w-4.5 h-4.5" />}
        tone="bg-amber-50 text-amber-700"
        href="/dashboard/inventory?level=LOW_STOCK"
      />
      <Card
        label="Out of Stock"
        value={formatNumber(summary.out)}
        icon={<PackageX className="w-4.5 h-4.5" />}
        tone="bg-rose-50 text-rose-700"
        href="/dashboard/inventory?level=OUT_OF_STOCK"
      />
    </div>
  );
}
