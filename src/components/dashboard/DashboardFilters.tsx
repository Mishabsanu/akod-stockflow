"use client";

import { PeriodFilter } from "@/components/reports/PeriodFilter";
import { useListParams } from "@/hooks/useListParams";
import { ORDER_TYPE_LABELS, ORDER_TYPES, type OrderType } from "@/lib/commerceTypes";
import type { PeriodKey } from "@/lib/periods";

/** Period presets + order type, both in the URL. */
export function DashboardFilters({ period, from, to, orderType }: { period: PeriodKey; from: string; to: string; orderType: OrderType | "" }) {
  const { update } = useListParams();
  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-2 lg:justify-between">
      <PeriodFilter period={period} from={from} to={to} />
      <label className="space-y-1 w-full sm:w-56">
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Order type</span>
        <select
          value={orderType}
          onChange={(e) => update({ orderType: e.target.value || undefined })}
          className="h-9 w-full px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand text-slate-800"
        >
          <option value="">All order types</option>
          {ORDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {ORDER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
