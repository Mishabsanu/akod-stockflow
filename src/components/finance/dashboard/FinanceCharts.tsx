"use client";

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactRupees, INK, SERIES } from "@/components/reports/chartTheme";
import { formatCurrency } from "@/lib/format";
import type { FinancePoint } from "@/server/services/finance/dashboard.service";

interface SeriesDef {
  key: keyof FinancePoint;
  label: string;
  color: string;
  line?: boolean;
}

function Legend({ series, points }: { series: SeriesDef[]; points: FinancePoint[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-[11.5px] text-slate-600">
          <span className={s.line ? "w-3 h-0.5 shrink-0" : "w-2.5 h-2.5 rounded-sm shrink-0"} style={{ background: s.color }} />
          {s.label}
          <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(points.reduce((sum, p) => sum + Number(p[s.key]), 0))}</span>
        </li>
      ))}
    </ul>
  );
}

function makeTooltip(series: SeriesDef[]) {
  return function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1 min-w-44">
        <p className="font-bold text-slate-900">{label}</p>
        {series.map((s) => (
          <p key={s.key} className="flex items-center gap-2 text-slate-600">
            <span className={s.line ? "w-2.5 h-0.5" : "w-2.5 h-2.5 rounded-sm"} style={{ background: s.color }} />
            {s.label}
            <span className="ml-auto font-semibold text-slate-900 tabular-nums">
              {formatCurrency(payload.find((p) => p.dataKey === s.key)?.value ?? 0)}
            </span>
          </p>
        ))}
      </div>
    );
  };
}

const axes = [
  <CartesianGrid key="grid" vertical={false} stroke={INK.grid} />,
  <XAxis key="x" dataKey="label" tick={{ fontSize: 11, fill: INK.secondary }} axisLine={{ stroke: INK.grid }} tickLine={false} minTickGap={18} />,
  <YAxis key="y" tickFormatter={compactRupees} tick={{ fontSize: 11, fill: INK.secondary }} axisLine={false} tickLine={false} width={56} />,
];

const empty = (text: string) => <p className="py-16 text-center text-xs text-slate-500">{text}</p>;

const REV_EXP: SeriesDef[] = [
  { key: "revenue", label: "Revenue", color: SERIES[0] },
  { key: "expenses", label: "Expenses", color: SERIES[1] },
];

const RevExpTip = makeTooltip(REV_EXP);

/** Revenue and expenses side by side per period (same unit, one axis). */
export function RevenueExpenseChart({ points }: { points: FinancePoint[] }) {
  const has = points.some((p) => p.revenue || p.expenses);
  return (
    <div>
      <Legend series={REV_EXP} points={points} />
      {has ? (
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%" barGap={2}>
              {axes}
              <Tooltip content={<RevExpTip />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
              {REV_EXP.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        empty("No revenue or expenses in this period yet")
      )}
    </div>
  );
}

const CASH: SeriesDef[] = [
  { key: "received", label: "Received", color: SERIES[2] },
  { key: "made", label: "Paid out", color: SERIES[1] },
  { key: "net", label: "Net cash flow", color: INK.primary, line: true },
];

const CashTip = makeTooltip(CASH);

/** Money in vs out per period, with the net as a line. */
export function CashFlowChart({ points }: { points: FinancePoint[] }) {
  const has = points.some((p) => p.received || p.made);
  return (
    <div>
      <Legend series={CASH} points={points} />
      {has ? (
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%" barGap={2}>
              {axes}
              <Tooltip content={<CashTip />} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
              <Bar dataKey="received" fill={CASH[0].color} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="made" fill={CASH[1].color} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line type="monotone" dataKey="net" stroke={CASH[2].color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        empty("No payments in this period yet")
      )}
    </div>
  );
}
