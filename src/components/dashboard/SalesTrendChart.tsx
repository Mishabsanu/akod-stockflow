"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactRupees, INK, ORDER_TYPE_COLOR, SERIES } from "@/components/reports/chartTheme";
import { ORDER_TYPE_LABELS, type OrderType } from "@/lib/commerceTypes";
import { formatCurrency } from "@/lib/format";
import type { TrendPoint } from "@/server/services/dashboard.service";

const TYPES: OrderType[] = ["MARKETPLACE", "LOCAL", "DISTRIBUTOR"];
const REVENUE_COLOR = SERIES[6];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? 0;
  const sales = TYPES.reduce((s, t) => s + value(t), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1 min-w-48">
      <p className="font-bold text-slate-900">{label}</p>
      {TYPES.map((t) => (
        <p key={t} className="flex items-center gap-2 text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ORDER_TYPE_COLOR[t] }} />
          {ORDER_TYPE_LABELS[t]}
          <span className="ml-auto font-semibold text-slate-900 tabular-nums">{formatCurrency(value(t))}</span>
        </p>
      ))}
      <p className="border-t border-slate-100 pt-1 flex gap-2 text-slate-600">
        Sales <span className="ml-auto font-bold text-slate-900 tabular-nums">{formatCurrency(sales)}</span>
      </p>
      <p className="flex items-center gap-2 text-slate-600">
        <span className="w-2.5 h-0.5" style={{ background: REVENUE_COLOR }} />
        Revenue <span className="ml-auto font-bold text-slate-900 tabular-nums">{formatCurrency(value("revenue"))}</span>
      </p>
    </div>
  );
}

/**
 * Sales per day / month stacked by order type, with revenue (sales income + other income) as a line.
 * Both are rupees, so they share one axis.
 */
export function SalesTrendChart({ points }: { points: TrendPoint[] }) {
  const totals = Object.fromEntries(TYPES.map((t) => [t, points.reduce((s, p) => s + p[t], 0)])) as Record<OrderType, number>;
  const revenue = points.reduce((s, p) => s + p.revenue, 0);
  const hasData = revenue > 0 || TYPES.some((t) => totals[t] > 0);
  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
        {TYPES.map((t) => (
          <li key={t} className="flex items-center gap-2 text-[11.5px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ORDER_TYPE_COLOR[t] }} />
            {ORDER_TYPE_LABELS[t]}
            <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(totals[t])}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-[11.5px] text-slate-600">
          <span className="w-3 h-0.5 shrink-0" style={{ background: REVENUE_COLOR }} />
          Revenue
          <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(revenue)}</span>
        </li>
      </ul>
      {hasData ? (
        <div className="h-60 sm:h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK.secondary }} axisLine={{ stroke: INK.grid }} tickLine={false} minTickGap={18} />
              <YAxis tickFormatter={compactRupees} tick={{ fontSize: 11, fill: INK.secondary }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
              {TYPES.map((t, i) => (
                <Bar
                  key={t}
                  dataKey={t}
                  stackId="sales"
                  fill={ORDER_TYPE_COLOR[t]}
                  stroke={INK.surface}
                  strokeWidth={1}
                  maxBarSize={22}
                  radius={i === TYPES.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
              <Line type="monotone" dataKey="revenue" stroke={REVENUE_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-xs text-slate-500">No sales in this period yet</p>
      )}
    </div>
  );
}
