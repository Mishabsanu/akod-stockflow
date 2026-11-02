"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ReportResult } from "@/lib/reportTypes";
import { compactRupees, INK, SERIES } from "./chartTheme";

type Chart = NonNullable<ReportResult["chart"]>;

function ChartTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  series: Chart["series"];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1 min-w-44">
      <p className="font-bold text-slate-900">{label}</p>
      {series.map((s, i) => (
        <p key={s.key} className="flex items-center gap-2 text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i] }} />
          {s.label}
          <span className="ml-auto font-semibold text-slate-900 tabular-nums">
            {formatCurrency(payload.find((p) => p.dataKey === s.key)?.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Grouped bars (one axis, rupees) for a report's per-period trend; legend carries each series total. */
export function ReportChart({ chart }: { chart: Chart }) {
  const totals = chart.series.map((s) => chart.points.reduce((sum, p) => sum + Number(p[s.key] ?? 0), 0));
  const hasData = totals.some((t) => t !== 0);
  return (
    <section className="bg-white border border-line rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h2 className="text-[13px] font-bold text-slate-900">{chart.title}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {chart.series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SERIES[i] }} />
              {s.label}
              <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(totals[i])}</span>
            </li>
          ))}
        </ul>
      </div>
      {hasData ? (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={2}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK.secondary }} axisLine={{ stroke: INK.grid }} tickLine={false} minTickGap={16} />
              <YAxis tickFormatter={compactRupees} tick={{ fontSize: 11, fill: INK.secondary }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<ChartTooltip series={chart.series} />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
              {chart.series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-12 text-center text-xs text-slate-500">No figures in this period yet</p>
      )}
    </section>
  );
}
